'use client';

import { useMemo, useState } from 'react';
import { User } from 'lucide-react';
import { getMyChildTimetable, type MyChild, type MyChildLesson } from '@/lib/analytics/api';
import {
  WEEKDAY_NAMES,
  defaultTimetableDay,
  isLessonNow,
  lessonTitle,
  lessonsForDay,
  timetableTabDays,
} from '@/lib/parent/portal';
import { useChildData } from '@/lib/parent/useChildData';
import { ChildGuard, ChildSwitcher, LoadFailure, ScreenSkeleton, TopBar, cardClass } from '@/components/parent/parts';

function classLabel(child: MyChild): string {
  return [child.className, child.streamName].filter(Boolean).join(' · ');
}

function LessonRow({ lesson, now }: { lesson: MyChildLesson; now: Date }) {
  const live = isLessonNow(lesson, now);
  return (
    <li className={`flex gap-3 px-4 py-3 ${live ? 'bg-brand-50' : ''}`} aria-current={live ? 'time' : undefined}>
      <div className="w-14 shrink-0 text-sm font-bold tabular-nums text-gray-900">
        {lesson.startTime}
        <span className="block text-xs font-medium text-gray-500">{lesson.endTime}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-sm font-bold text-gray-900">
          <span className="truncate">{lessonTitle(lesson)}</span>
          {live && <span className="shrink-0 rounded-full bg-brand-600 px-2 py-0.5 text-xs font-bold text-white">Now</span>}
        </p>
        {(lesson.teacherName || lesson.room) && (
          <p className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500">
            {lesson.teacherName && (
              <span className="inline-flex items-center gap-1">
                <User className="h-3.5 w-3.5" aria-hidden="true" />
                {lesson.teacherName}
              </span>
            )}
            {lesson.room && <span>Room {lesson.room}</span>}
          </p>
        )}
      </div>
    </li>
  );
}

function TimetableBody({ child }: { child: MyChild }) {
  const timetable = useChildData(child.studentId, getMyChildTimetable, 'Could not load the timetable.');
  const [now] = useState(() => new Date());
  const today = now.getDay();
  const [picked, setPicked] = useState<number>(() => defaultTimetableDay(now));
  const lessons = timetable.data;
  const tabs = useMemo(() => timetableTabDays(lessons ?? []), [lessons]);
  const dayLessons = useMemo(() => lessonsForDay(lessons ?? [], picked), [lessons, picked]);

  if (timetable.error) return <div className="px-5"><LoadFailure message={timetable.error} onRetry={timetable.retry} /></div>;
  if (!lessons) return <ScreenSkeleton />;

  const label = classLabel(child);

  return (
    <div className="space-y-5 px-5">
      <ChildSwitcher />

      {lessons.length === 0 ? (
        <p className={`${cardClass} p-6 text-center text-sm text-gray-500`}>
          The school has not published a timetable for {label || 'this class'} yet. It appears here once lessons are entered.
        </p>
      ) : (
        <>
          <div role="tablist" aria-label="Day of the week" className="-mx-5 flex gap-1.5 overflow-x-auto px-5 pb-1">
            {tabs.map((d) => {
              const on = d === picked;
              return (
                <button
                  key={d}
                  type="button"
                  role="tab"
                  id={`day-tab-${d}`}
                  aria-selected={on}
                  aria-controls="day-panel"
                  aria-label={WEEKDAY_NAMES[d]}
                  onClick={() => setPicked(d)}
                  className={`min-h-[2.75rem] min-w-[3.25rem] shrink-0 rounded-xl px-3 text-sm font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600 ${on ? 'bg-brand-600 text-white shadow' : 'bg-white text-gray-500 shadow-sm'}`}
                >
                  {WEEKDAY_NAMES[d].slice(0, 3)}
                  {d === today && <span className="block text-[0.625rem] font-semibold leading-none opacity-80">Today</span>}
                </button>
              );
            })}
          </div>

          <section id="day-panel" role="tabpanel" aria-labelledby={`day-tab-${picked}`} className={cardClass}>
            <p className="px-4 pt-4 text-sm text-gray-500">
              {WEEKDAY_NAMES[picked]}
              {label ? ` · ${label}` : ''}
            </p>
            {dayLessons.length === 0 ? (
              <p className="px-4 pb-6 pt-3 text-center text-sm text-gray-500">No lessons on {WEEKDAY_NAMES[picked]}.</p>
            ) : (
              <ul className="mt-2 divide-y divide-gray-100 pb-1">
                {dayLessons.map((l) => <LessonRow key={l.entryId} lesson={l} now={now} />)}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function Timetable({ child }: { child: MyChild }) {
  if (!child.classId) {
    return (
      <div className="space-y-5 px-5">
        <ChildSwitcher />
        <p className={`${cardClass} p-6 text-center text-sm text-gray-500`}>
          {child.fullName} is not placed in a class yet, so there is no timetable to show. Please contact the school.
        </p>
      </div>
    );
  }
  return <TimetableBody child={child} />;
}

export default function TimetablePage() {
  return (
    <>
      <TopBar eyebrow="Weekly lessons" title="Timetable" backHref="/parent/more" />
      <ChildGuard>{(child) => <Timetable key={child.studentId} child={child} />}</ChildGuard>
    </>
  );
}
