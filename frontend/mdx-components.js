import Link from "next/link";

// Elements for the MDX pages under app/docs. Internal links go through next/link; everything
// else keeps its HTML element and is styled by app/docs/docs.module.css through the .prose class.
export function useMDXComponents(components) {
  return {
    a: ({ href, children, ...rest }) =>
      href?.startsWith("/") ? (
        <Link href={href} {...rest}>
          {children}
        </Link>
      ) : (
        <a href={href} target={href?.startsWith("http") ? "_blank" : undefined} rel="noreferrer" {...rest}>
          {children}
        </a>
      ),
    ...components,
  };
}
