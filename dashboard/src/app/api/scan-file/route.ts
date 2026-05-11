/**
 * File scan endpoint.
 *
 *   POST /api/scan-file
 *
 *   Two request shapes:
 *   1. multipart/form-data with field `file` — PDF or DOCX. Server extracts text.
 *   2. application/json `{ file_name, file_type: 'image', extracted_text }` —
 *      for client-side OCR (images), avoiding shipping tesseract.js to the
 *      serverless function.
 */

import { NextRequest, NextResponse } from 'next/server';
import { analyzeText, ScanResult } from '@/lib/scannerEngine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_TEXT_CHARS = 1_000_000;

const ALLOWED_PDF_MIME = new Set(['application/pdf']);
const ALLOWED_DOCX_MIME = new Set([
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);
const ALLOWED_EXT = new Set(['pdf', 'docx', 'png', 'jpg', 'jpeg']);

function jsonError(message: string, status: number) {
    return NextResponse.json({ status: 'error', error: message }, { status });
}

function sanitizeFilename(raw: string): string {
    // Strip any path components and keep only the basename.
    const base = raw.replace(/^.*[\\/]/, '');
    // Allow letters, digits, dot, dash, underscore. Replace everything else.
    const cleaned = base.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 200);
    return cleaned || 'unnamed';
}

function extOf(name: string): string {
    const i = name.lastIndexOf('.');
    return i >= 0 ? name.slice(i + 1).toLowerCase() : '';
}

async function extractPdf(buf: Buffer): Promise<string> {
    const { PDFParse }: any = await import('pdf-parse');
    const parser = new PDFParse({ data: new Uint8Array(buf) });
    const result = await parser.getText();
    return String(result?.text ?? '');
}

async function extractDocx(buf: Buffer): Promise<string> {
    const mammoth: any = await import('mammoth');
    const fn = mammoth.extractRawText ?? mammoth.default?.extractRawText;
    const result = await fn({ buffer: buf });
    return String(result?.value ?? '');
}

async function handleMultipart(req: NextRequest): Promise<NextResponse> {
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
        return jsonError('Missing "file" field', 400);
    }
    if (file.size > MAX_BYTES) {
        return jsonError(`File exceeds ${MAX_BYTES / (1024 * 1024)} MB limit`, 413);
    }

    const safeName = sanitizeFilename(file.name);
    const ext = extOf(safeName);
    if (!ALLOWED_EXT.has(ext)) {
        return jsonError(`Unsupported extension ".${ext}"`, 415);
    }

    const buf = Buffer.from(await file.arrayBuffer());
    let text: string;
    let fileType: string;

    if (ext === 'pdf') {
        if (file.type && !ALLOWED_PDF_MIME.has(file.type)) {
            return jsonError(`Unexpected MIME for PDF: ${file.type}`, 415);
        }
        text = await extractPdf(buf);
        fileType = 'pdf';
    } else if (ext === 'docx') {
        if (file.type && !ALLOWED_DOCX_MIME.has(file.type)) {
            return jsonError(`Unexpected MIME for DOCX: ${file.type}`, 415);
        }
        text = await extractDocx(buf);
        fileType = 'docx';
    } else {
        // Images should arrive as JSON with pre-OCR'd text; server-side OCR
        // would push the function size past Vercel limits.
        return jsonError(
            `Image files must be OCR'd client-side and submitted as JSON.`,
            400,
        );
    }

    if (text.length > MAX_TEXT_CHARS) {
        text = text.slice(0, MAX_TEXT_CHARS);
    }

    const result = analyzeText(text, { file_name: safeName, file_type: fileType });
    return NextResponse.json({ ...result, extracted_text: text });
}

async function handleJson(req: NextRequest): Promise<NextResponse> {
    let body: any;
    try {
        body = await req.json();
    } catch {
        return jsonError('Invalid JSON body', 400);
    }

    const rawName = typeof body?.file_name === 'string' ? body.file_name : '';
    const fileType = typeof body?.file_type === 'string' ? body.file_type : '';
    const text = typeof body?.extracted_text === 'string' ? body.extracted_text : '';

    if (!rawName || !fileType || text === '') {
        return jsonError('Missing file_name, file_type, or extracted_text', 400);
    }

    const safeName = sanitizeFilename(rawName);
    const ext = extOf(safeName);
    if (!ALLOWED_EXT.has(ext)) {
        return jsonError(`Unsupported extension ".${ext}"`, 415);
    }
    const allowedTypes = new Set(['pdf', 'docx', 'image', 'png', 'jpg', 'jpeg']);
    if (!allowedTypes.has(fileType)) {
        return jsonError(`Unsupported file_type "${fileType}"`, 415);
    }

    const clipped = text.length > MAX_TEXT_CHARS ? text.slice(0, MAX_TEXT_CHARS) : text;
    const result: ScanResult = analyzeText(clipped, {
        file_name: safeName,
        file_type: fileType,
    });
    return NextResponse.json({ ...result, extracted_text: clipped });
}

export async function POST(req: NextRequest) {
    try {
        const ct = req.headers.get('content-type') ?? '';
        if (ct.startsWith('multipart/form-data')) {
            return await handleMultipart(req);
        }
        if (ct.startsWith('application/json')) {
            return await handleJson(req);
        }
        return jsonError(
            'Content-Type must be multipart/form-data or application/json',
            415,
        );
    } catch (e: any) {
        return jsonError(e?.message ?? 'Scan failed', 500);
    }
}
