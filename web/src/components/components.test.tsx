import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetThemeStore, setThemePreference, THEME_KEY } from '../lib/theme';
import { Highlight } from './Highlight';
import { LyricsView } from './LyricsView';
import { Pagination } from './Pagination';
import { ThemeToggle } from './ThemeToggle';

describe('ThemeToggle', () => {
  beforeEach(() => {
    window.localStorage.setItem(THEME_KEY, 'light');
    resetThemeStore();
    setThemePreference('light');
  });

  it('passe de clair à sombre puis système, applique et mémorise le thème', async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);
    const button = screen.getByRole('button', { name: /Thème clair/ });
    expect(document.documentElement).not.toHaveClass('dark');

    await user.click(button);
    expect(document.documentElement).toHaveClass('dark');
    expect(window.localStorage.getItem(THEME_KEY)).toBe('dark');
    expect(button).toHaveAccessibleName(/Thème sombre\. Passer au thème du système/);

    await user.click(button);
    expect(window.localStorage.getItem(THEME_KEY)).toBe('system');
    // jsdom : pas de préférence système sombre.
    expect(document.documentElement).not.toHaveClass('dark');
  });
});

describe('LyricsView', () => {
  it('affiche une strophe par paragraphe et distingue le refrain', () => {
    const { container } = render(
      <LyricsView lyrics={'Andalana 1\nAndalana 2\n\nRef: Tiako ianao\n  Mba lazao'} />,
    );
    const stanzas = container.querySelectorAll('p');
    const lines = (stanza: Element) =>
      [...stanza.querySelectorAll('span')].map((span) => span.textContent);
    expect(stanzas).toHaveLength(2);
    expect(lines(stanzas[0]!)).toEqual(['Andalana 1', 'Andalana 2']);
    expect(stanzas[0]).not.toHaveAttribute('data-chorus');
    expect(stanzas[1]).toHaveAttribute('data-chorus');
    expect(lines(stanzas[1]!)).toEqual(['Ref: Tiako ianao', '  Mba lazao']);
  });

  it('indique des paroles absentes', () => {
    render(<LyricsView lyrics="   " />);
    expect(screen.getByText(/ne sont pas disponibles/)).toBeInTheDocument();
  });
});

describe('Pagination', () => {
  const renderPagination = (page: number, totalPages: number) =>
    render(
      <MemoryRouter>
        <Pagination page={page} totalPages={totalPages} hrefFor={(p) => `?page=${p}`} />
      </MemoryRouter>,
    );

  it("n'affiche rien pour une seule page", () => {
    const { container } = renderPagination(1, 1);
    expect(container).toBeEmptyDOMElement();
  });

  it('marque la page courante et propose précédente et suivante', () => {
    renderPagination(3, 10);
    expect(screen.getByRole('link', { current: 'page' })).toHaveTextContent('3');
    expect(screen.getByRole('link', { name: /Précédente/ })).toHaveAttribute('href', '/?page=2');
    expect(screen.getByRole('link', { name: /Suivante/ })).toHaveAttribute('href', '/?page=4');
  });

  it('désactive « Suivante » sur la dernière page', () => {
    renderPagination(10, 10);
    expect(screen.queryByRole('link', { name: /Suivante/ })).toBeNull();
  });
});

describe('Highlight', () => {
  it('surligne la recherche sans tenir compte des accents', () => {
    const { container } = render(<Highlight text="Tanàna malalako" query="tanana" />);
    expect(container.querySelector('mark')).toHaveTextContent('Tanàna');
  });
});
