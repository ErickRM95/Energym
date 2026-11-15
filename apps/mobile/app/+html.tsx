import { ScrollViewStyleReset, useServerDocumentContext } from "expo-router/html";
import type { ReactNode } from "react";

export default function Root({ children }: { children: ReactNode }) {
  const { headNodes, bodyNodes } = useServerDocumentContext();
  return (
    <html lang="es" className="dark">
      <head>
        <meta charSet="utf-8" />
        <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: responsiveBackground }} />
        {headNodes}
      </head>
      <body>
        {children}
        {bodyNodes}
      </body>
    </html>
  );
}

const themeBoot = `try{if(localStorage.getItem("energym-theme")==="light")document.documentElement.classList.remove("dark");}catch(e){}`;

const responsiveBackground = `
body { background-color: #f3f4ef; }
html.dark body { background-color: #101410; }`;
