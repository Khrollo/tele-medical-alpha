import * as React from "react";

const TINTS: Array<[string, string]> = [
  ["oklch(0.92 0.04 30)", "oklch(0.42 0.1 30)"],
  ["oklch(0.92 0.04 90)", "oklch(0.42 0.1 90)"],
  ["oklch(0.92 0.04 170)", "oklch(0.42 0.08 190)"],
  ["oklch(0.92 0.04 260)", "oklch(0.42 0.08 260)"],
  ["oklch(0.92 0.04 340)", "oklch(0.42 0.08 340)"],
];

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

type AvatarProps = {
  name?: string;
  /**
   * Optional profile image URL. When present and loadable, renders the image;
   * otherwise falls back to tinted initials derived from `name`.
   */
  src?: string | null;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
};

export function Avatar({ name = "?", src, size = 32, className, style }: AvatarProps) {
  const [imgFailed, setImgFailed] = React.useState(false);
  const initials = name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const [bg, fg] = TINTS[hashStr(name) % TINTS.length];
  const showImage = Boolean(src) && !imgFailed;

  React.useEffect(() => {
    setImgFailed(false);
  }, [src]);

  return (
    <span
      className={className}
      aria-label={name}
      role="img"
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: 9999,
        background: bg,
        color: fg,
        fontSize: size * 0.38,
        fontWeight: 600,
        letterSpacing: "0.02em",
        flexShrink: 0,
        overflow: "hidden",
        ...style,
      }}
    >
      {showImage ? (
        // We need the native error event here so broken public Storage URLs
        // can fall back to initials immediately instead of hanging on an empty frame.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src ?? undefined}
          alt=""
          onError={() => setImgFailed(true)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
        />
      ) : (
        <span aria-hidden="true">{initials}</span>
      )}
    </span>
  );
}
