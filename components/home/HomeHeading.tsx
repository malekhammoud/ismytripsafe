// The landing page's one H1. Kept as its own no-dependency component so the
// heading is server-rendered HTML with the rest of the landing copy passed
// through `HomeClient`'s `children`, and so a regression test can assert the
// exact text without booting the whole page's report index.
export function HomeHeading() {
  return (
    <section className="mt-8 text-center">
      <h1 className="font-display mx-auto max-w-2xl text-[1.6rem] font-medium leading-tight tracking-tight text-[var(--navy)] sm:text-[2rem]">
        Is it safe to travel there? Check any city with real safety data.
      </h1>
    </section>
  )
}
