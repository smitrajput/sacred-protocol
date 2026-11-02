import Link from "next/link";

// A sentence with one phrase in it linked, when the copy names one.
export default function Linked({ text, link }) {
  if (!link) return text;
  const [before, after] = text.split(link.text);
  return (
    <>
      {before}
      <Link href={link.href}>{link.text}</Link>
      {after}
    </>
  );
}
