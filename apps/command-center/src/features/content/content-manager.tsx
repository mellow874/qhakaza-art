'use client';

import { useState } from 'react';

import type { AdminContent } from './actions';

/**
 * Editing what the public sites say.
 *
 * DEMO CONTENT IS CALLED OUT, LOUDLY. Rows the development team wrote to fill
 * a page carry a flag, and this screen counts them at the top. Placeholder copy
 * that nobody remembers to replace is how a developer's invented FAQ answer
 * ends up quoted back at Qhakaza in a meeting - so it is made hard to forget
 * rather than left to be noticed.
 *
 * Editing a demo row replaces it and clears the flag. There is no button to
 * dismiss the warning without doing the work, deliberately.
 */

type Fn = (
  input: unknown,
) => Promise<{ ok: boolean; error?: string; fieldErrors?: Record<string, string> }>;

type Tab = 'faq' | 'briefings' | 'news' | 'legal';

const TABS: { key: Tab; label: string; note: string }[] = [
  { key: 'faq', label: 'FAQ', note: 'Questions and answers on the artist site.' },
  { key: 'briefings', label: 'Briefings', note: 'Longer pieces. Sources matter here.' },
  { key: 'news', label: 'News', note: 'Short announcements.' },
  {
    key: 'legal',
    label: 'Terms & privacy',
    note: 'Versioned. Publishing new terms never edits the old ones.',
  },
];

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-muted border-line border border-dashed p-6 text-sm">{children}</p>;
}

export function ContentManager({
  content,
  canEditNews,
  canEditLegal,
  onSaveFaq,
  onPublishFaq,
  onAddCategory,
  onSaveBriefing,
  onSaveNews,
  onPublishLegal,
}: {
  content: AdminContent;
  canEditNews: boolean;
  canEditLegal: boolean;
  onSaveFaq: Fn;
  onPublishFaq: Fn;
  onAddCategory: Fn;
  onSaveBriefing: Fn;
  onSaveNews: Fn;
  onPublishLegal: Fn;
}) {
  const [tab, setTab] = useState<Tab>('faq');
  const meta = TABS.find((entry) => entry.key === tab)!;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-3">
        <h1 className="text-heading font-serif text-3xl">Content</h1>
        <p className="text-muted max-w-2xl text-sm leading-relaxed">
          Everything the public sites say, editable here. Changes appear immediately.
        </p>

        {content.demoCount > 0 && (
          <div className="border-danger/40 bg-danger/5 border p-4">
            <p className="text-danger text-sm leading-relaxed">
              <strong>
                {content.demoCount} {content.demoCount === 1 ? 'item is' : 'items are'} still
                placeholder text written by the development team.
              </strong>{' '}
              The public pages say so while any remain. They are marked below — editing one replaces
              it with Qhakaza&rsquo;s own words and clears the notice.
            </p>
          </div>
        )}
      </header>

      <nav className="flex flex-wrap gap-2">
        {TABS.map((entry) => (
          <button
            key={entry.key}
            type="button"
            onClick={() => setTab(entry.key)}
            className={
              tab === entry.key
                ? 'border-accent text-accent caps border px-3 py-1 text-xs'
                : 'border-line text-muted hover:border-line-strong caps border px-3 py-1 text-xs'
            }
          >
            {entry.label}
          </button>
        ))}
      </nav>

      <p className="text-muted text-sm">{meta.note}</p>

      {tab === 'faq' && (
        <FaqPanel
          content={content}
          onSave={onSaveFaq}
          onPublish={onPublishFaq}
          onAddCategory={onAddCategory}
        />
      )}
      {tab === 'briefings' && <BriefingPanel content={content} onSave={onSaveBriefing} />}
      {tab === 'news' && <NewsPanel content={content} canEdit={canEditNews} onSave={onSaveNews} />}
      {tab === 'legal' && (
        <LegalPanel content={content} canEdit={canEditLegal} onPublish={onPublishLegal} />
      )}
    </div>
  );
}

function DemoChip() {
  return (
    <span className="border-danger text-danger caps border px-2 py-0.5 text-xs">
      Placeholder text
    </span>
  );
}

// ---------------------------------------------------------------------------

function FaqPanel({
  content,
  onSave,
  onPublish,
  onAddCategory,
}: {
  content: AdminContent;
  onSave: Fn;
  onPublish: Fn;
  onAddCategory: Fn;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [newCategory, setNewCategory] = useState('');

  return (
    <div className="flex flex-col gap-8">
      {content.faqs.length === 0 ? (
        <Empty>No questions yet.</Empty>
      ) : (
        <ul className="border-line/70 flex flex-col border-t">
          {content.faqs.map((item) => (
            <li key={item.id} className="border-line/70 flex flex-col gap-2 border-b py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <span className="flex flex-col gap-1">
                  <span className="text-heading text-sm">{item.question}</span>
                  <span className="text-muted text-xs">{item.category.label}</span>
                </span>
                <span className="flex items-center gap-3">
                  {item.isDemo && <DemoChip />}
                  <button
                    type="button"
                    onClick={() => onPublish({ id: item.id, published: !item.published })}
                    className={
                      item.published ? 'caps text-accent text-xs' : 'caps text-muted text-xs'
                    }
                  >
                    {item.published ? 'Live' : 'Hidden'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(editing === item.id ? null : item.id)}
                    className="text-muted hover:text-accent caps text-xs"
                  >
                    {editing === item.id ? 'Close' : 'Edit'}
                  </button>
                </span>
              </div>

              {editing === item.id ? (
                <FaqForm
                  categories={content.categories}
                  initial={item}
                  onSave={onSave}
                  onDone={() => setEditing(null)}
                />
              ) : (
                <p className="text-body max-w-2xl text-sm leading-relaxed">{item.answer}</p>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="border-line/70 bg-surface/40 flex flex-col gap-3 border p-4">
        <h3 className="caps text-muted">Add a question</h3>
        <FaqForm categories={content.categories} onSave={onSave} />
      </div>

      <div className="border-line/70 flex flex-wrap items-end gap-3 border p-4">
        <label className="flex flex-1 flex-col gap-1">
          <span className="caps text-muted">New category</span>
          <input
            type="text"
            value={newCategory}
            onChange={(event) => setNewCategory(event.target.value)}
            className="border-line bg-canvas border px-3 py-2 text-sm"
          />
        </label>
        <button
          type="button"
          disabled={!newCategory.trim()}
          onClick={async () => {
            await onAddCategory({ label: newCategory.trim() });
            setNewCategory('');
          }}
          className="border-accent text-accent caps hover:bg-accent/10 border px-4 py-2 text-xs disabled:opacity-40"
        >
          Add
        </button>
      </div>
    </div>
  );
}

function FaqForm({
  categories,
  initial,
  onSave,
  onDone,
}: {
  categories: AdminContent['categories'];
  initial?: AdminContent['faqs'][number];
  onSave: Fn;
  onDone?: () => void;
}) {
  const [question, setQuestion] = useState(initial?.question ?? '');
  const [answer, setAnswer] = useState(initial?.answer ?? '');
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? categories[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <select
        value={categoryId}
        onChange={(event) => setCategoryId(event.target.value)}
        className="border-line bg-canvas border px-3 py-2 text-sm"
      >
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.label}
          </option>
        ))}
      </select>

      <input
        type="text"
        value={question}
        onChange={(event) => setQuestion(event.target.value)}
        placeholder="Question"
        className="border-line bg-canvas border px-3 py-2 text-sm"
      />

      <textarea
        rows={4}
        value={answer}
        onChange={(event) => setAnswer(event.target.value)}
        placeholder="Answer, in Qhakaza's words"
        className="border-line bg-canvas border px-3 py-2 text-sm"
      />

      {error && (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      )}

      <button
        type="button"
        disabled={busy || !question.trim() || !answer.trim() || !categoryId}
        onClick={async () => {
          setBusy(true);
          setError(null);
          const result = await onSave({
            id: initial?.id,
            categoryId,
            question: question.trim(),
            answer: answer.trim(),
            published: initial?.published ?? false,
            ordering: initial?.ordering ?? 0,
          });
          setBusy(false);
          if (result.ok) {
            if (!initial) {
              setQuestion('');
              setAnswer('');
            }
            onDone?.();
          } else setError(result.error ?? 'That did not save.');
        }}
        className="border-accent text-accent caps hover:bg-accent/10 self-start border px-4 py-2 text-xs disabled:opacity-40"
      >
        {initial ? 'Save changes' : 'Add question'}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------

function BriefingPanel({ content, onSave }: { content: AdminContent; onSave: Fn }) {
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-8">
      {content.briefings.length === 0 ? (
        <Empty>No briefings yet.</Empty>
      ) : (
        <ul className="border-line/70 flex flex-col border-t">
          {content.briefings.map((briefing) => (
            <li key={briefing.id} className="border-line/70 flex flex-col gap-2 border-b py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <span className="flex flex-col gap-1">
                  <span className="text-heading text-sm">{briefing.title}</span>
                  <span className="text-muted text-xs">
                    {[briefing.author, briefing.category, briefing.status]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                  {/* A briefing making market claims without sources is the
                      thing VERA exists to argue against. Said where it lands. */}
                  {!briefing.sources && (
                    <span className="text-danger text-xs">No sources recorded</span>
                  )}
                </span>
                <span className="flex items-center gap-3">
                  {briefing.isDemo && <DemoChip />}
                  <button
                    type="button"
                    onClick={() => setEditing(editing === briefing.id ? null : briefing.id)}
                    className="text-muted hover:text-accent caps text-xs"
                  >
                    {editing === briefing.id ? 'Close' : 'Edit'}
                  </button>
                </span>
              </div>

              {editing === briefing.id && (
                <BriefingForm initial={briefing} onSave={onSave} onDone={() => setEditing(null)} />
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="border-line/70 bg-surface/40 flex flex-col gap-3 border p-4">
        <h3 className="caps text-muted">Write a briefing</h3>
        <BriefingForm onSave={onSave} />
      </div>
    </div>
  );
}

function BriefingForm({
  initial,
  onSave,
  onDone,
}: {
  initial?: AdminContent['briefings'][number];
  onSave: Fn;
  onDone?: () => void;
}) {
  const [values, setValues] = useState({
    title: initial?.title ?? '',
    subtitle: initial?.subtitle ?? '',
    author: initial?.author ?? '',
    category: initial?.category ?? '',
    excerpt: initial?.excerpt ?? '',
    body: initial?.body ?? '',
    sources: initial?.sources ?? '',
    status: initial?.status ?? 'DRAFT',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof typeof values) => (value: string) =>
    setValues((current) => ({ ...current, [key]: value }));

  const field = 'border-line bg-canvas border px-3 py-2 text-sm';

  return (
    <div className="flex flex-col gap-3">
      <input
        type="text"
        value={values.title}
        onChange={(event) => set('title')(event.target.value)}
        placeholder="Title"
        className={field}
      />
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          value={values.author}
          onChange={(event) => set('author')(event.target.value)}
          placeholder="Author"
          className={`${field} flex-1`}
        />
        <input
          type="text"
          value={values.category}
          onChange={(event) => set('category')(event.target.value)}
          placeholder="Category"
          className={`${field} flex-1`}
        />
      </div>
      <textarea
        rows={2}
        value={values.excerpt}
        onChange={(event) => set('excerpt')(event.target.value)}
        placeholder="Summary, shown in listings"
        className={field}
      />
      <textarea
        rows={8}
        value={values.body}
        onChange={(event) => set('body')(event.target.value)}
        placeholder="The briefing itself"
        className={field}
      />
      <textarea
        rows={3}
        value={values.sources}
        onChange={(event) => set('sources')(event.target.value)}
        placeholder="Where the claims come from — one per line"
        className={field}
      />

      <select
        value={values.status}
        onChange={(event) => set('status')(event.target.value)}
        className={field}
      >
        <option value="DRAFT">Draft — not visible</option>
        <option value="PUBLISHED">Published — live on the site</option>
        <option value="ARCHIVED">Archived</option>
      </select>

      {error && (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      )}

      <button
        type="button"
        disabled={busy || !values.title.trim() || !values.excerpt.trim()}
        onClick={async () => {
          setBusy(true);
          setError(null);
          const result = await onSave({
            id: initial?.id,
            title: values.title.trim(),
            subtitle: values.subtitle.trim() || undefined,
            author: values.author.trim() || undefined,
            category: values.category.trim() || undefined,
            excerpt: values.excerpt.trim(),
            body: values.body.trim() || undefined,
            sources: values.sources.trim() || undefined,
            status: values.status,
          });
          setBusy(false);
          if (result.ok) onDone?.();
          else setError(result.error ?? 'That did not save.');
        }}
        className="border-accent text-accent caps hover:bg-accent/10 self-start border px-4 py-2 text-xs disabled:opacity-40"
      >
        {initial ? 'Save changes' : 'Create briefing'}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------

function NewsPanel({
  content,
  canEdit,
  onSave,
}: {
  content: AdminContent;
  canEdit: boolean;
  onSave: Fn;
}) {
  const [values, setValues] = useState({
    title: '',
    category: '',
    excerpt: '',
    body: '',
    status: 'DRAFT',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const field = 'border-line bg-canvas border px-3 py-2 text-sm';
  const set = (key: keyof typeof values) => (value: string) =>
    setValues((current) => ({ ...current, [key]: value }));

  return (
    <div className="flex flex-col gap-8">
      {content.news.length === 0 ? (
        <Empty>No news yet.</Empty>
      ) : (
        <ul className="border-line/70 flex flex-col border-t">
          {content.news.map((article) => (
            <li
              key={article.id}
              className="border-line/70 flex flex-wrap items-baseline justify-between gap-3 border-b py-3"
            >
              <span className="flex flex-col gap-1">
                <span className="text-heading text-sm">{article.title}</span>
                <span className="text-muted text-xs">{article.category}</span>
              </span>
              <span
                className={
                  article.status === 'PUBLISHED'
                    ? 'caps text-accent text-xs'
                    : 'caps text-muted text-xs'
                }
              >
                {article.status.toLowerCase()}
              </span>
            </li>
          ))}
        </ul>
      )}

      {canEdit ? (
        <div className="border-line/70 bg-surface/40 flex flex-col gap-3 border p-4">
          <h3 className="caps text-muted">Post an announcement</h3>
          <input
            type="text"
            value={values.title}
            onChange={(event) => set('title')(event.target.value)}
            placeholder="Title"
            className={field}
          />
          <input
            type="text"
            value={values.category}
            onChange={(event) => set('category')(event.target.value)}
            placeholder="Category"
            className={field}
          />
          <textarea
            rows={2}
            value={values.excerpt}
            onChange={(event) => set('excerpt')(event.target.value)}
            placeholder="Summary"
            className={field}
          />
          <textarea
            rows={6}
            value={values.body}
            onChange={(event) => set('body')(event.target.value)}
            placeholder="The announcement"
            className={field}
          />
          <select
            value={values.status}
            onChange={(event) => set('status')(event.target.value)}
            className={field}
          >
            <option value="DRAFT">Draft</option>
            <option value="PUBLISHED">Published</option>
          </select>

          {error && (
            <p role="alert" className="text-danger text-sm">
              {error}
            </p>
          )}

          <button
            type="button"
            disabled={
              busy || !values.title.trim() || !values.excerpt.trim() || !values.category.trim()
            }
            onClick={async () => {
              setBusy(true);
              setError(null);
              const result = await onSave({
                title: values.title.trim(),
                category: values.category.trim(),
                excerpt: values.excerpt.trim(),
                body: values.body.trim() || undefined,
                status: values.status,
              });
              setBusy(false);
              if (result.ok) {
                setValues({ title: '', category: '', excerpt: '', body: '', status: 'DRAFT' });
              } else setError(result.error ?? 'That did not save.');
            }}
            className="border-accent text-accent caps hover:bg-accent/10 self-start border px-4 py-2 text-xs disabled:opacity-40"
          >
            Post
          </button>
        </div>
      ) : (
        <p className="text-muted text-xs">Only an administrator can post news.</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function LegalPanel({
  content,
  canEdit,
  onPublish,
}: {
  content: AdminContent;
  canEdit: boolean;
  onPublish: Fn;
}) {
  const [values, setValues] = useState({
    documentKey: 'TERMS',
    versionNumber: '',
    title: '',
    body: '',
    effectiveFrom: '',
    publish: true,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const field = 'border-line bg-canvas border px-3 py-2 text-sm';

  return (
    <div className="flex flex-col gap-8">
      <p className="text-muted max-w-2xl text-xs leading-relaxed">
        Publishing a new version archives the one it replaces and leaves it intact. You have to be
        able to show what someone agreed to on the day they agreed to it, so nothing here is ever
        edited or deleted.
      </p>

      {content.legal.length === 0 ? (
        <Empty>No legal documents published.</Empty>
      ) : (
        <ul className="border-line/70 flex flex-col border-t">
          {content.legal.map((version) => (
            <li
              key={version.id}
              className="border-line/70 flex flex-wrap items-baseline justify-between gap-3 border-b py-3"
            >
              <span className="flex flex-col gap-1">
                <span className="text-heading text-sm">
                  {version.documentKey} &middot; {version.versionNumber}
                </span>
                <span className="text-muted text-xs">
                  In force from {version.effectiveFrom.toLocaleDateString('en-ZA')}
                </span>
              </span>
              <span className="flex items-center gap-3">
                {version.isDemo && <DemoChip />}
                <span
                  className={
                    version.status === 'PUBLISHED'
                      ? 'caps text-accent text-xs'
                      : 'caps text-muted text-xs'
                  }
                >
                  {version.status.toLowerCase()}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}

      {canEdit ? (
        <div className="border-line/70 bg-surface/40 flex flex-col gap-3 border p-4">
          <h3 className="caps text-muted">Publish a new version</h3>

          <div className="flex flex-wrap gap-3">
            <select
              value={values.documentKey}
              onChange={(event) =>
                setValues((current) => ({ ...current, documentKey: event.target.value }))
              }
              className={field}
            >
              <option value="TERMS">Terms of service</option>
              <option value="PRIVACY">Privacy policy</option>
            </select>
            <input
              type="text"
              value={values.versionNumber}
              onChange={(event) =>
                setValues((current) => ({ ...current, versionNumber: event.target.value }))
              }
              placeholder="Version, e.g. 2.0"
              className={field}
            />
            <input
              type="date"
              value={values.effectiveFrom}
              onChange={(event) =>
                setValues((current) => ({ ...current, effectiveFrom: event.target.value }))
              }
              className={field}
            />
          </div>

          <input
            type="text"
            value={values.title}
            onChange={(event) =>
              setValues((current) => ({ ...current, title: event.target.value }))
            }
            placeholder="Title"
            className={field}
          />

          <textarea
            rows={12}
            value={values.body}
            onChange={(event) => setValues((current) => ({ ...current, body: event.target.value }))}
            placeholder="The document. This must come from Qhakaza or its lawyers — we have not written one for you."
            className={field}
          />

          <label className="text-muted flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={values.publish}
              onChange={(event) =>
                setValues((current) => ({ ...current, publish: event.target.checked }))
              }
            />
            Make this the version in force
          </label>

          {error && (
            <p role="alert" className="text-danger text-sm">
              {error}
            </p>
          )}

          <button
            type="button"
            disabled={
              busy ||
              !values.versionNumber.trim() ||
              !values.title.trim() ||
              !values.body.trim() ||
              !values.effectiveFrom
            }
            onClick={async () => {
              setBusy(true);
              setError(null);
              const result = await onPublish({
                documentKey: values.documentKey,
                versionNumber: values.versionNumber.trim(),
                title: values.title.trim(),
                body: values.body.trim(),
                effectiveFrom: values.effectiveFrom,
                publish: values.publish,
              });
              setBusy(false);
              if (result.ok) {
                setValues({
                  documentKey: values.documentKey,
                  versionNumber: '',
                  title: '',
                  body: '',
                  effectiveFrom: '',
                  publish: true,
                });
              } else setError(result.error ?? 'That did not save.');
            }}
            className="border-accent text-accent caps hover:bg-accent/10 self-start border px-4 py-2 text-xs disabled:opacity-40"
          >
            Publish this version
          </button>
        </div>
      ) : (
        <p className="text-muted text-xs">Only an administrator can publish a legal document.</p>
      )}
    </div>
  );
}
