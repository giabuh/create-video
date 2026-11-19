// bundled assets resolve to URLs (Remotion's webpack: asset/resource; the app's Vite: same)
declare module '*.woff2' {
  const url: string;
  export default url;
}
