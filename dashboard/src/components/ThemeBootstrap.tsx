// Runs as inline script in <head> to set data-theme before first paint,
// preventing a flash of the wrong theme on hydration.
export function ThemeBootstrap() {
    const code = `(function(){try{var k='promptshield-theme';var t=localStorage.getItem(k);if(t!=='classic'&&t!=='futuristic'){t='futuristic';}document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','futuristic');}})();`;
    return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
