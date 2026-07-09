"use client";

import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import { Calendar as BigCalendar, dateFnsLocalizer } from "react-big-calendar";
import type { EventPropGetter, SlotInfo, View } from "react-big-calendar";
import { addDays, addMonths, addWeeks, format, getDay, parse, startOfWeek } from "date-fns";
import { es } from "date-fns/locale/es";
import { CalendarPlus, ChevronLeft, ChevronRight, MapPin, X } from "lucide-react";
import { getAppointmentDetails } from "@/lib/business-rules";
import { appData } from "@/lib/seed-data";
import type { Appointment } from "@/lib/types";
import { ScheduleForm } from "./schedule-form";

type GroomingCalendarEvent = {
  id: number;
  title: string;
  start: Date;
  end: Date;
  appointment: Appointment;
  groomerColor?: string;
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales: {
    "es-GT": es
  }
});

const viewLabels: Record<View, string> = {
  month: "Mes",
  week: "Semana",
  work_week: "Semana laboral",
  day: "Dia",
  agenda: "Lista"
};

function dateForInput(date: Date) {
  return format(date, "yyyy-MM-dd");
}

function timeForInput(date: Date) {
  return format(date, "HH:mm");
}

function atHour(date: Date, hour: number) {
  const next = new Date(date);
  next.setHours(hour, 0, 0, 0);
  return next;
}

function navigateDate(date: Date, view: View, direction: number) {
  if (view === "month") {
    return addMonths(date, direction);
  }
  if (view === "week") {
    return addWeeks(date, direction);
  }
  return addDays(date, direction);
}

function calendarTitle(date: Date, view: View) {
  if (view === "month") {
    return format(date, "MMMM yyyy", { locale: es });
  }
  if (view === "week") {
    const start = startOfWeek(date, { weekStartsOn: 1 });
    const end = addDays(start, 6);
    return `${format(start, "d MMM", { locale: es })} - ${format(end, "d MMM yyyy", { locale: es })}`;
  }
  return format(date, "EEEE d 'de' MMMM yyyy", { locale: es });
}

function hexToRgba(hexColor: string | undefined, alpha: number) {
  const fallback = "#0F766E";
  const hex = /^#[0-9A-F]{6}$/i.test(hexColor ?? "") ? hexColor! : fallback;
  const red = Number.parseInt(hex.slice(1, 3), 16);
  const green = Number.parseInt(hex.slice(3, 5), 16);
  const blue = Number.parseInt(hex.slice(5, 7), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function eventStyle(calendarColor?: string): CSSProperties {
  return {
    backgroundColor: hexToRgba(calendarColor, 0.18),
    border: `1px solid ${hexToRgba(calendarColor, 0.44)}`,
    borderLeft: `4px solid ${calendarColor ?? "#0F766E"}`,
    borderRadius: 8,
    color: "#1f2933",
    fontWeight: 600,
    paddingLeft: 6
  };
}

function buildEvent(appointment: Appointment): GroomingCalendarEvent {
  const { branch, pet, services, groomer } = getAppointmentDetails(appData, appointment);
  return {
    id: appointment.id,
    title: `${pet.name} · ${groomer.name} · ${branch.name} · ${services.map((service) => service.name).join(", ")}`,
    start: new Date(appointment.scheduledStart),
    end: new Date(appointment.scheduledEnd),
    appointment,
    groomerColor: groomer.calendarColor
  };
}

export function AgendaCalendar() {
  const [selectedBranchId, setSelectedBranchId] = useState<number | "all">("all");
  const [selectedGroomerId, setSelectedGroomerId] = useState<number | "all">("all");
  const [selectedDate, setSelectedDate] = useState(new Date("2026-06-23T12:00:00-06:00"));
  const [selectedView, setSelectedView] = useState<View>("day");
  const [modalState, setModalState] = useState<{ date: string; time: string } | null>(null);

  const selectedBranch = appData.branches.find((branch) => branch.id === selectedBranchId);
  const groomers = appData.users.filter(
    (user) => user.role === "groomer" && (selectedBranchId === "all" || user.branchIds.includes(selectedBranchId))
  );
  const events = useMemo(
    () =>
      appData.appointments
        .filter((appointment) => selectedBranchId === "all" || appointment.branchId === selectedBranchId)
        .filter((appointment) => selectedGroomerId === "all" || appointment.groomerId === selectedGroomerId)
        .map(buildEvent),
    [selectedBranchId, selectedGroomerId]
  );

  const calendarEventStyle: EventPropGetter<GroomingCalendarEvent> = (event) => ({
    style: eventStyle(event.groomerColor)
  });

  const openAppointmentModal = (date: Date) => {
    setModalState({
      date: dateForInput(date),
      time: timeForInput(date)
    });
  };

  return (
    <section className="flex h-screen flex-col overflow-hidden bg-cloud">
      <header className="border-b border-slate-200 bg-white px-4 py-3 lg:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-jade">Agenda</p>
            <h1 className="text-2xl font-semibold text-ink">Calendario de grooming</h1>
            <p className="mt-1 flex items-center gap-2 text-sm text-slate-500">
              <MapPin className="h-4 w-4" aria-hidden="true" />
              {selectedBranch?.name ?? "Todas las sucursales"}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-slate-300 bg-white p-1">
              {(["day", "week", "month"] as View[]).map((view) => (
                <button
                  key={view}
                  className={`focus-ring rounded-md px-3 py-1.5 text-sm font-semibold transition ${
                    selectedView === view ? "bg-jade text-white" : "text-slate-600 hover:bg-cloud"
                  }`}
                  type="button"
                  onClick={() => setSelectedView(view)}
                >
                  {viewLabels[view]}
                </button>
              ))}
            </div>
            <div className="flex items-center rounded-lg border border-slate-300 bg-white">
              <button
                className="focus-ring flex h-10 w-10 items-center justify-center rounded-l-lg text-slate-600 hover:bg-cloud"
                type="button"
                onClick={() => setSelectedDate(navigateDate(selectedDate, selectedView, -1))}
                aria-label="Anterior"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                className="focus-ring h-10 border-x border-slate-300 px-3 text-sm font-semibold text-slate-600 hover:bg-cloud"
                type="button"
                onClick={() => setSelectedDate(new Date())}
              >
                Hoy
              </button>
              <button
                className="focus-ring flex h-10 w-10 items-center justify-center rounded-r-lg text-slate-600 hover:bg-cloud"
                type="button"
                onClick={() => setSelectedDate(navigateDate(selectedDate, selectedView, 1))}
                aria-label="Siguiente"
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <select
              className="focus-ring rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              value={selectedBranchId}
              onChange={(event) => {
                setSelectedBranchId(event.target.value === "all" ? "all" : Number(event.target.value));
                setSelectedGroomerId("all");
              }}
            >
              <option value="all">Todas las sucursales</option>
              {appData.branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
            <select
              className="focus-ring rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              value={selectedGroomerId}
              onChange={(event) => setSelectedGroomerId(event.target.value === "all" ? "all" : Number(event.target.value))}
            >
              <option value="all">Todos los groomers</option>
              {groomers.map((groomer) => (
                <option key={groomer.id} value={groomer.id}>
                  {groomer.name}
                </option>
              ))}
            </select>
            <input
              className="focus-ring h-10 rounded-lg border border-slate-300 px-3 text-sm"
              type="date"
              value={dateForInput(selectedDate)}
              onChange={(event) => setSelectedDate(new Date(`${event.target.value}T12:00:00-06:00`))}
            />
            <button
              className="focus-ring inline-flex h-10 items-center gap-2 rounded-lg bg-jade px-4 text-sm font-semibold text-white shadow-panel transition hover:bg-emerald-700"
              type="button"
              onClick={() => openAppointmentModal(atHour(selectedDate, 9))}
            >
              <CalendarPlus className="h-4 w-4" aria-hidden="true" />
              Agendar cita
            </button>
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 p-3">
        <div className="h-full rounded-lg border border-slate-200 bg-white p-3 shadow-panel">
          <div className="mb-3 text-center text-sm font-bold capitalize text-ink">
            {calendarTitle(selectedDate, selectedView)}
          </div>
          <BigCalendar<GroomingCalendarEvent>
            culture="es-GT"
            date={selectedDate}
            dayLayoutAlgorithm="no-overlap"
            endAccessor="end"
            eventPropGetter={calendarEventStyle}
            events={events}
            localizer={localizer}
            max={atHour(selectedDate, 18)}
            messages={{
              allDay: "Todo el dia",
              date: "Fecha",
              day: "Dia",
              event: "Cita",
              month: "Mes",
              next: "Siguiente",
              noEventsInRange: "No hay citas en este rango.",
              previous: "Anterior",
              showMore: (total) => `+${total} mas`,
              time: "Hora",
              today: "Hoy",
              tomorrow: "Manana",
              week: "Semana",
              yesterday: "Ayer"
            }}
            min={atHour(selectedDate, 8)}
            onNavigate={(date) => setSelectedDate(date)}
            onSelectEvent={(event) => openAppointmentModal(event.start)}
            onSelectSlot={(slotInfo: SlotInfo) => openAppointmentModal(slotInfo.start)}
            onView={(view) => setSelectedView(view)}
            popup
            selectable
            startAccessor="start"
            step={30}
            timeslots={2}
            titleAccessor="title"
            toolbar={false}
            view={selectedView}
            views={["day", "week", "month"]}
          />
        </div>
      </div>

      {modalState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-auto rounded-lg bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3 border-b border-slate-200 pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-jade">Nueva cita</p>
                <h2 className="text-xl font-semibold text-ink">
                  {modalState.date} · {modalState.time}
                </h2>
              </div>
              <button
                className="focus-ring flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-cloud hover:text-ink"
                type="button"
                onClick={() => setModalState(null)}
                aria-label="Cerrar modal"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <ScheduleForm
              key={`${modalState.date}-${modalState.time}`}
              initialDate={modalState.date}
              initialTime={modalState.time}
            />
          </div>
        </div>
      )}
    </section>
  );
}
