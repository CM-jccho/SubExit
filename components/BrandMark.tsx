export default function BrandMark({ size = 44 }: { size?: number }) {
  return (
    <img
      className="speak-brand-mark"
      src="/brand/speakcoaching-mark-v1.webp"
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
    />
  );
}
