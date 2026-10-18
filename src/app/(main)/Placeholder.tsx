export default function Placeholder({
  title,
  desc,
}: {
  title: string;
  desc: string;
}) {
  return (
    <section>
      <h2 className="mb-3 text-base font-bold">{title}</h2>
      <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-500">
        <p className="mb-1 font-medium text-neutral-700">다음 단계에서 구현 예정</p>
        <p>{desc}</p>
      </div>
    </section>
  );
}
