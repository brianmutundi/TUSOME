'use client';

import { useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import type { MyChild, MyChildHomework } from '@/lib/analytics/api';
import { homeworkDueLabel, homeworkErrorMessage, splitHomework } from '@/lib/homework';
import { useParent } from '@/components/parent/ParentContext';
import { ChildGuard, ChildSwitcher, LoadFailure, ScreenSkeleton, SectionHeading, TopBar, cardClass } from '@/components/parent/parts';

function HomeworkRow({
  item,
  tone,
  now,
  pending,
  onToggle,
}: {
  item: MyChildHomework;
  tone: 'todo' | 'overdue' | 'done';
  now: Date;
  pending: boolean;
  onToggle: (item: MyChildHomework) => void;
}) {
  const dueTone = tone === 'overdue' ? 'text-danger-600' : tone === 'done' ? 'text-gray-500' : 'text-gray-700';
  return (
    <li className="flex gap-3 px-4 py-3">
      <button
        type="button"
        role="checkbox"
        aria-checked={item.isDone}
        aria-label={`${item.title}: mark as ${item.isDone ? 'not done' : 'done'}`}
        disabled={pending}
        onClick={() => onToggle(item)}
        className="-m-1 grid h-11 w-11 shrink-0 place-items-center rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600 disabled:opacity-50"
      >
        <span
          className={`grid h-6 w-6 place-items-center rounded-md border-2 ${item.isDone ? 'border-success-600 bg-success-600 text-white' : 'border-gray-300 bg-white'}`}
        >
          {item.isDone && <Check className="h-4 w-4" aria-hidden="true" />}
        </span>
      </button>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-bold text-brand-700">{item.subjectName}</span>
          <span className={`text-xs font-semibold ${dueTone}`}>{homeworkDueLabel(item.dueDate, now)}</span>
        </p>
        <p className={`mt-1 break-words text-sm font-bold ${item.isDone ? 'text-gray-500 line-through' : 'text-gray-900'}`}>{item.title}</p>
        {item.instructions && <p className="mt-1 whitespace-pre-line break-words text-sm text-gray-600">{item.instructions}</p>}
        {item.teacherName && <p className="mt-1 text-xs text-gray-500">Set by {item.teacherName}</p>}
      </div>
    </li>
  );
}

function Section({ title, items, tone, now, pendingId, onToggle }: {
  title: string;
  items: MyChildHomework[];
  tone: 'todo' | 'overdue' | 'done';
  now: Date;
  pendingId: string | null;
  onToggle: (item: MyChildHomework) => void;
}) {
  if (items.length === 0) return null;
  return (
    <section>
      <SectionHeading title={`${title} (${items.length})`} />
      <ul className={`${cardClass} mt-2 divide-y divide-gray-100`}>
        {items.map((h) => (
          <HomeworkRow key={h.assignmentId} item={h} tone={tone} now={now} pending={pendingId === h.assignmentId} onToggle={onToggle} />
        ))}
      </ul>
    </section>
  );
}

function HomeworkBody({ child }: { child: MyChild }) {
  const { homework, homeworkError, reloadHomework, setHomeworkDone } = useParent();
  const [now] = useState(() => new Date());
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const groups = useMemo(() => splitHomework(homework ?? [], now), [homework, now]);

  const toggle = async (item: MyChildHomework) => {
    setPendingId(item.assignmentId);
    setSaveError(null);
    try {
      await setHomeworkDone(item.assignmentId, !item.isDone);
    } catch (caught) {
      console.error('setHomeworkDone failed:', caught);
      setSaveError(homeworkErrorMessage(caught, 'Could not save that. Check your connection and try again.'));
    } finally {
      setPendingId(null);
    }
  };

  if (homeworkError) return <div className="px-5"><LoadFailure message={homeworkError} onRetry={reloadHomework} /></div>;
  if (!homework) return <ScreenSkeleton />;

  return (
    <div className="space-y-5 px-5">
      <ChildSwitcher />

      <p className="rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-800">
        Tick an item when {child.fullName.split(/\s+/)[0]} has done it. This is your own note: teachers do not mark or grade it.
      </p>

      {saveError && <p role="alert" className="text-sm font-medium text-danger-600">{saveError}</p>}

      {homework.length === 0 ? (
        <p className={`${cardClass} p-6 text-center text-sm text-gray-500`}>
          No homework set for {child.fullName.split(/\s+/)[0]} right now. It appears here when a teacher publishes it.
        </p>
      ) : (
        <>
          {groups.todo.length === 0 && groups.overdue.length === 0 && (
            <p className={`${cardClass} p-5 text-center text-sm font-semibold text-success-700`}>Nothing left to do. All caught up.</p>
          )}
          <Section title="To do" items={groups.todo} tone="todo" now={now} pendingId={pendingId} onToggle={toggle} />
          <Section title="Overdue" items={groups.overdue} tone="overdue" now={now} pendingId={pendingId} onToggle={toggle} />
          <Section title="Done" items={groups.done} tone="done" now={now} pendingId={pendingId} onToggle={toggle} />
        </>
      )}
    </div>
  );
}

function Homework({ child }: { child: MyChild }) {
  if (!child.classId) {
    return (
      <div className="space-y-5 px-5">
        <ChildSwitcher />
        <p className={`${cardClass} p-6 text-center text-sm text-gray-500`}>
          {child.fullName} is not placed in a class yet, so there is no homework to show. Please contact the school.
        </p>
      </div>
    );
  }
  return <HomeworkBody child={child} />;
}

export default function HomeworkPage() {
  return (
    <>
      <TopBar eyebrow="Assignments" title="Homework" />
      <ChildGuard>{(child) => <Homework key={child.studentId} child={child} />}</ChildGuard>
    </>
  );
}
