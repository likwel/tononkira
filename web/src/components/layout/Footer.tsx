export function Footer() {
  return (
    <footer className="mt-24 border-t border-line print:hidden">
      <div className="container-page flex flex-col gap-2 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
        <p>
          <span className="font-serif text-base text-ink">Tononkira</span> — les paroles des
          chansons malagasy.
        </p>
        <p>
          Paroles © leurs auteurs · source :{' '}
          <a
            href="https://tononkira.serasera.org"
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-line underline-offset-4 transition-colors hover:text-accent"
          >
            tononkira.serasera.org
          </a>
        </p>
      </div>
    </footer>
  );
}
