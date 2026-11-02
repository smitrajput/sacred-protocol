import Link from "next/link";

// A heading's id, from its text, so sections can be linked to.
const slug = (children) =>
  []
    .concat(children)
    .filter((part) => typeof part === "string")
    .join("")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

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
    h2: ({ children, ...rest }) => (
      <h2 id={slug(children)} {...rest}>
        {children}
      </h2>
    ),
    h3: ({ children, ...rest }) => (
      <h3 id={slug(children)} {...rest}>
        {children}
      </h3>
    ),
    ...components,
  };
}
