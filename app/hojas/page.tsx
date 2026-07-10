"use client";

import Image from "next/image";
import { useMemo, useRef, useState } from "react";
import type { ChangeEvent, FocusEvent, FormEvent, KeyboardEvent, PointerEvent } from "react";
import {
  CalendarDays,
  Camera,
  CheckCircle2,
  Clock3,
  PenLine,
  Plus,
  RotateCcw,
  Upload,
  UserRound,
  X
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { formatGuatemalaDateTime, getAppointmentDetails, minutesBetween } from "@/lib/business-rules";
import { appData } from "@/lib/seed-data";
import type { AppData, AppointmentSource } from "@/lib/types";

const mainServiceOptions = [
  { id: "grooming_completo", label: "Grooming completo", serviceId: 2, hasSubservices: true },
  { id: "bano", label: "Baño", serviceId: 1, hasSubservices: true },
  { id: "corte_unas", label: "Corte de uñas", serviceId: 3, hasSubservices: false }
] as const;

const subServiceOptions = [
  { id: "estandar", label: "Estandar" },
  { id: "shampoo_medicado", label: "Shampoo medicado" },
  { id: "shampoo_anti_pulgas", label: "Shampoo anti pulgas" }
] as const;

const visibleConditionOptions = [
  "Heridas visibles",
  "Raspones",
  "Piel irritada / enrojecida",
  "Costras",
  "Inflamacion",
  "Cojera",
  "Dolor al tocar"
];

const parasiteOptions = ["Pulgas", "Garrapatas", "Piojos"];

function todayForInput() {
  return new Date().toISOString().slice(0, 10);
}

function addMinutes(date: string, time: string, minutesToAdd: number) {
  const start = new Date(`${date}T${time}:00-06:00`);
  start.setMinutes(start.getMinutes() + minutesToAdd);
  return start.toISOString().replace("Z", "-06:00");
}

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function SignatureStatus({
  imageUrl,
  label,
  name,
  signedAt
}: {
  imageUrl?: string;
  label: string;
  name?: string;
  signedAt?: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-center gap-2">
        {name ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
        ) : (
          <PenLine className="h-4 w-4 text-amber-600" aria-hidden="true" />
        )}
        <p className="text-sm font-semibold text-ink">{label}</p>
      </div>
      <p className="mt-2 text-sm text-slate-600">{name ?? "Pendiente de firma"}</p>
      {signedAt && <p className="mt-1 text-xs text-slate-500">{formatGuatemalaDateTime(signedAt)}</p>}
      {imageUrl && (
        <div
          className="mt-3 h-20 rounded-lg border border-slate-200 bg-white bg-contain bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${imageUrl})` }}
          aria-label={`Firma de ${name ?? label}`}
        />
      )}
    </div>
  );
}

function PhotoSlot({ label, photoUrl }: { label: string; photoUrl?: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="relative aspect-[4/3] bg-cloud">
        {photoUrl?.startsWith("data:") ? (
          <div className="h-full bg-cover bg-center" style={{ backgroundImage: `url(${photoUrl})` }} />
        ) : photoUrl ? (
          <Image src={photoUrl} alt={label} fill sizes="(min-width: 1024px) 18rem, 50vw" className="object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-slate-400">
            <Camera className="h-7 w-7" aria-hidden="true" />
          </div>
        )}
      </div>
      <p className="px-3 py-2 text-sm font-semibold text-ink">{label}</p>
    </div>
  );
}

function SignaturePad({
  signerName,
  value,
  onSignerNameChange,
  onChange
}: {
  signerName: string;
  value: string;
  onSignerNameChange: (name: string) => void;
  onChange: (signatureUrl: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  const prepareCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const scale = window.devicePixelRatio || 1;
    const width = Math.floor(rect.width * scale);
    const height = Math.floor(rect.height * scale);

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) return null;
      context.scale(scale, scale);
      context.lineCap = "round";
      context.lineJoin = "round";
      context.lineWidth = 3;
      context.strokeStyle = "#1f2933";
    }

    return canvas;
  };

  const pointFromEvent = (event: PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  };

  const saveSignature = () => {
    const canvas = canvasRef.current;
    if (canvas) onChange(canvas.toDataURL("image/png"));
  };

  const handlePointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = prepareCanvas();
    if (!canvas) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    isDrawingRef.current = true;
    lastPointRef.current = pointFromEvent(event);
  };

  const handlePointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !lastPointRef.current) return;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!context) return;

    const nextPoint = pointFromEvent(event);
    context.beginPath();
    context.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    context.lineTo(nextPoint.x, nextPoint.y);
    context.stroke();
    lastPointRef.current = nextPoint;
  };

  const stopDrawing = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    lastPointRef.current = null;
    saveSignature();
  };

  const clearSignature = () => {
    const canvas = prepareCanvas();
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    onChange("");
  };

  return (
    <div className="grid gap-2 rounded-lg border border-slate-200 p-3 md:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="grid min-w-56 flex-1 gap-1 text-sm font-medium text-slate-700">
          Firma de entrega
          <input
            className="focus-ring rounded-lg border border-slate-300 px-3 py-2"
            value={signerName}
            onChange={(event) => onSignerNameChange(event.target.value)}
            placeholder="Nombre de quien firma"
          />
        </label>
        <button
          className="focus-ring inline-flex items-center gap-2 self-end rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-cloud"
          type="button"
          onClick={clearSignature}
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Limpiar
        </button>
      </div>
      <canvas
        ref={canvasRef}
        className="h-48 w-full touch-none rounded-lg border border-dashed border-slate-300 bg-white"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopDrawing}
        onPointerCancel={stopDrawing}
        aria-label="Area para dibujar firma"
      />
      <p className="text-xs text-slate-500">
        Dibuje con el dedo o Apple Pencil sobre el recuadro.
      </p>
      {value && <p className="text-xs font-semibold text-emerald-700">Firma capturada.</p>}
    </div>
  );
}

function NewServiceModal({
  data,
  onClose,
  onCreate
}: {
  data: AppData;
  onClose: () => void;
  onCreate: (data: AppData) => void;
}) {
  const initialBranchId = data.branches[0]?.id ?? 0;
  const initialGroomerId =
    data.users.find((user) => user.role === "groomer" && user.branchIds.includes(initialBranchId))?.id ?? 0;
  const [petId, setPetId] = useState(0);
  const [petSearch, setPetSearch] = useState("");
  const [isPetSearchOpen, setIsPetSearchOpen] = useState(false);
  const [branchId, setBranchId] = useState(initialBranchId);
  const [groomerId, setGroomerId] = useState(initialGroomerId);
  const [mainServiceId, setMainServiceId] = useState("grooming_completo");
  const [subServiceId, setSubServiceId] = useState("estandar");
  const [date, setDate] = useState(todayForInput());
  const [time, setTime] = useState("09:00");
  const [source, setSource] = useState<AppointmentSource>("walk_in");
  const [conditionLabels, setConditionLabels] = useState<string[]>([]);
  const [parasiteLabels, setParasiteLabels] = useState<string[]>([]);
  const [additionalObservations, setAdditionalObservations] = useState("");
  const [intakeSignatureName, setIntakeSignatureName] = useState("");
  const [intakeSignatureImageUrl, setIntakeSignatureImageUrl] = useState("");
  const [beforePhotoUrl, setBeforePhotoUrl] = useState("");

  const selectedPet = data.pets.find((pet) => pet.id === petId);
  const selectedCustomer = data.customers.find((customer) => customer.id === selectedPet?.customerId);
  const filteredGroomers = data.users.filter((user) => user.role === "groomer" && user.branchIds.includes(branchId));
  const selectedMainService = mainServiceOptions.find((service) => service.id === mainServiceId);
  const selectedServiceIds: number[] = selectedMainService ? [selectedMainService.serviceId] : [];
  const filteredPets = data.pets
    .map((pet) => ({
      pet,
      customer: data.customers.find((customer) => customer.id === pet.customerId)
    }))
    .filter(({ customer, pet }) => {
      const query = normalizeSearch(petSearch);
      if (!query) return true;
      const searchableText = normalizeSearch(`${pet.name} ${customer?.name ?? ""} ${pet.breed}`);
      return query.split(" ").every((term) => searchableText.includes(term));
    })
    .slice(0, 6);
  const selectedServices = data.services.filter((service) => selectedServiceIds.includes(service.id));
  const duration = selectedServices.reduce((total, service) => total + service.estimatedDurationMinutes, 0) || 30;

  const readPhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") setBeforePhotoUrl(reader.result);
    });
    reader.readAsDataURL(file);
  };

  const chooseBranch = (nextBranchId: number) => {
    setBranchId(nextBranchId);
    setGroomerId(data.users.find((user) => user.role === "groomer" && user.branchIds.includes(nextBranchId))?.id ?? 0);
  };

  const choosePet = (nextPetId: number) => {
    const pet = data.pets.find((item) => item.id === nextPetId);
    const customer = data.customers.find((item) => item.id === pet?.customerId);
    if (!pet) return;
    setPetId(pet.id);
    setPetSearch(`${pet.name} - ${customer?.name ?? "Sin dueño"}`);
    setIsPetSearchOpen(true);
  };

  const handlePetSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (filteredPets.length === 1) {
      choosePet(filteredPets[0].pet.id);
    }
  };

  const closePetSearchOnBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setIsPetSearchOpen(false);
    }
  };

  const toggleLabel = (label: string, setter: (labels: (current: string[]) => string[]) => void) => {
    setter((current) => (current.includes(label) ? current.filter((item) => item !== label) : [...current, label]));
  };

  const buildNotes = () => {
    const selectedSubService = subServiceOptions.find((service) => service.id === subServiceId);
    const lines = [
      `Servicio: ${selectedMainService?.label ?? "Sin servicio"}`,
      selectedMainService?.hasSubservices
        ? `Subservicio: ${selectedSubService?.label ?? "Sin subservicio"}`
        : "",
      conditionLabels.length ? `Condiciones visibles: ${conditionLabels.join(", ")}` : "",
      parasiteLabels.length ? `Parasitos visibles: ${parasiteLabels.join(", ")}` : "",
      additionalObservations.trim() ? `Observaciones adicionales: ${additionalObservations.trim()}` : ""
    ];
    return lines.filter(Boolean).join("\n");
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedPet || selectedServiceIds.length === 0 || !groomerId) return;

    const nextAppointmentId = Math.max(0, ...data.appointments.map((appointment) => appointment.id)) + 1;
    const nextRecordId = Math.max(0, ...data.groomingRecords.map((record) => record.id)) + 1;
    const scheduledStart = `${date}T${time}:00-06:00`;

    onCreate({
      ...data,
      appointments: [
        {
          id: nextAppointmentId,
          branchId,
          petId,
          groomerId,
          serviceIds: selectedServiceIds,
          scheduledStart,
          scheduledEnd: addMinutes(date, time, duration),
          status: "checked_in",
          source,
          notes: buildNotes(),
          createdById: 2
        },
        ...data.appointments
      ],
      groomingRecords: [
        {
          id: nextRecordId,
          appointmentId: nextAppointmentId,
          actualStart: scheduledStart,
          groomerNotes: "",
          outcome: "",
          intakeSignatureName: intakeSignatureName.trim() || selectedCustomer?.name,
          intakeSignatureImageUrl,
          intakeSignedAt: new Date().toISOString(),
          satisfactionNotes: "",
          beforePhotoUrl,
          afterPhotoUrl: ""
        },
        ...data.groomingRecords
      ]
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-auto rounded-lg bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3 border-b border-slate-200 pb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-jade">Nueva hoja</p>
            <h2 className="text-xl font-semibold text-ink">Nuevo servicio</h2>
          </div>
          <button
            className="focus-ring flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-cloud hover:text-ink"
            type="button"
            onClick={onClose}
            aria-label="Cerrar modal"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
          <div className="relative grid gap-2 text-sm font-medium text-slate-700" onBlur={closePetSearchOnBlur}>
            Mascota
            <input
              className="focus-ring rounded-lg border border-slate-300 px-3 py-2"
              type="search"
              value={petSearch}
              onChange={(event) => {
                setPetId(0);
                setPetSearch(event.target.value);
                setIsPetSearchOpen(true);
              }}
              onFocus={() => setIsPetSearchOpen(true)}
              onKeyDown={handlePetSearchKeyDown}
              placeholder="Buscar por mascota o dueño"
            />
            {isPetSearchOpen && (
              <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-44 overflow-auto rounded-lg border border-slate-200 bg-white shadow-panel">
                {filteredPets.map(({ customer, pet }) => (
                  <button
                    key={pet.id}
                    className={`focus-ring flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-cloud ${
                      pet.id === petId ? "bg-emerald-50 text-emerald-900" : "text-slate-700"
                    }`}
                    type="button"
                    onClick={() => choosePet(pet.id)}
                  >
                    <span>
                      <span className="block font-semibold">{pet.name}</span>
                      <span className="text-xs text-slate-500">{customer?.name}</span>
                    </span>
                    <span className="text-xs text-slate-500">{pet.breed}</span>
                  </button>
                ))}
                {filteredPets.length === 0 && <p className="px-3 py-2 text-sm text-slate-500">Sin resultados.</p>}
              </div>
            )}
          </div>
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            Sucursal
            <select
              className="focus-ring rounded-lg border border-slate-300 px-3 py-2"
              value={branchId}
              onChange={(event) => chooseBranch(Number(event.target.value))}
            >
              {data.branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            Groomer
            <select
              className="focus-ring rounded-lg border border-slate-300 px-3 py-2"
              value={groomerId}
              onChange={(event) => setGroomerId(Number(event.target.value))}
            >
              {filteredGroomers.map((groomer) => (
                <option key={groomer.id} value={groomer.id}>
                  {groomer.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            Origen
            <select
              className="focus-ring rounded-lg border border-slate-300 px-3 py-2"
              value={source}
              onChange={(event) => setSource(event.target.value as AppointmentSource)}
            >
              <option value="walk_in">Mostrador</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="phone">Telefono</option>
              <option value="online">Online futuro</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            Fecha
            <span className="focus-within:ring-2 focus-within:ring-jade focus-within:ring-offset-2 flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3">
              <CalendarDays className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              <input
                className="h-full min-w-0 flex-1 bg-transparent text-sm text-ink outline-none"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </span>
          </label>
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            Hora de entrega
            <span className="focus-within:ring-2 focus-within:ring-jade focus-within:ring-offset-2 flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3">
              <Clock3 className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              <input
                className="h-full min-w-0 flex-1 bg-transparent text-sm text-ink outline-none"
                type="time"
                value={time}
                onChange={(event) => setTime(event.target.value)}
              />
            </span>
          </label>
          <fieldset className="grid gap-3 rounded-lg border border-slate-200 p-3 md:col-span-2">
            <legend className="px-1 text-sm font-semibold text-slate-700">Servicios comprados</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {mainServiceOptions.map((service) => (
                <label key={service.id} className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    className="h-4 w-4 accent-jade"
                    name="main-service"
                    type="radio"
                    checked={mainServiceId === service.id}
                    onChange={() => setMainServiceId(service.id)}
                  />
                  {service.label}
                </label>
              ))}
            </div>
            {selectedMainService?.hasSubservices && (
              <div className="grid gap-2 rounded-lg bg-cloud p-3 sm:grid-cols-3">
                {subServiceOptions.map((service) => (
                  <label key={service.id} className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      className="h-4 w-4 accent-jade"
                      name="sub-service"
                      type="radio"
                      checked={subServiceId === service.id}
                      onChange={() => setSubServiceId(service.id)}
                    />
                    {service.label}
                  </label>
                ))}
              </div>
            )}
          </fieldset>
          <fieldset className="grid gap-3 rounded-lg border border-slate-200 p-3 md:col-span-2">
            <legend className="px-1 text-sm font-semibold text-slate-700">Condiciones visibles</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {visibleConditionOptions.map((label) => (
                <label key={label} className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    className="h-4 w-4 accent-jade"
                    type="checkbox"
                    checked={conditionLabels.includes(label)}
                    onChange={() => toggleLabel(label, setConditionLabels)}
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="grid gap-3 rounded-lg border border-slate-200 p-3 md:col-span-2">
            <legend className="px-1 text-sm font-semibold text-slate-700">Parasitos visibles</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {parasiteOptions.map((label) => (
                <label key={label} className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    className="h-4 w-4 accent-jade"
                    type="checkbox"
                    checked={parasiteLabels.includes(label)}
                    onChange={() => toggleLabel(label, setParasiteLabels)}
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="grid gap-1 text-sm font-medium text-slate-700 md:col-span-2">
            Observaciones adicionales
            <textarea
              className="focus-ring min-h-20 rounded-lg border border-slate-300 px-3 py-2"
              value={additionalObservations}
              onChange={(event) => setAdditionalObservations(event.target.value)}
              placeholder="Detalle adicional del dueño o del estado de ingreso"
            />
          </label>
          <SignaturePad
            signerName={intakeSignatureName}
            value={intakeSignatureImageUrl}
            onSignerNameChange={setIntakeSignatureName}
            onChange={setIntakeSignatureImageUrl}
          />
          <div className="grid gap-2 rounded-lg border border-slate-200 p-3 md:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-700">Foto antes</p>
                <p className="text-xs text-slate-500">En iPad abre la camara; en desktop permite elegir archivo.</p>
              </div>
              <label className="focus-ring inline-flex cursor-pointer items-center gap-2 rounded-lg bg-jade px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
                <Upload className="h-4 w-4" aria-hidden="true" />
                Tomar foto
                <input className="sr-only" type="file" accept="image/*" capture="environment" onChange={readPhoto} />
              </label>
            </div>
            <div className="overflow-hidden rounded-lg border border-dashed border-slate-300 bg-cloud">
              {beforePhotoUrl ? (
                <div
                  className="h-56 bg-cover bg-center"
                  style={{ backgroundImage: `url(${beforePhotoUrl})` }}
                  aria-label="Vista previa de foto antes"
                />
              ) : (
                <div className="flex h-56 items-center justify-center text-slate-400">
                  <Camera className="h-8 w-8" aria-hidden="true" />
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2 md:col-span-2">
            <button
              className="focus-ring rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-cloud"
              type="button"
              onClick={onClose}
            >
              Cancelar
            </button>
            <button
              className="focus-ring inline-flex items-center gap-2 rounded-lg bg-jade px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              type="submit"
              disabled={!selectedPet || selectedServiceIds.length === 0 || !groomerId}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Crear hoja
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function HojasPage() {
  const [data, setData] = useState<AppData>(appData);
  const [showNewService, setShowNewService] = useState(false);
  const serviceSheets = useMemo(
    () =>
      data.appointments
        .map((appointment) => ({
          appointment,
          ...getAppointmentDetails(data, appointment)
        }))
        .sort(
          (first, second) =>
            new Date(second.appointment.scheduledStart).getTime() -
            new Date(first.appointment.scheduledStart).getTime()
        ),
    [data]
  );

  return (
    <AppShell>
      <PageContainer>
        <PageHeader
          eyebrow="Operacion diaria"
          title="Hojas de servicio"
          description="Registro digital de servicios comprados, indicaciones, fotos y firmas de entrega y conformidad."
          action={
            <button
              className="focus-ring inline-flex h-10 items-center gap-2 rounded-lg bg-jade px-4 text-sm font-semibold text-white shadow-panel hover:bg-emerald-700"
              type="button"
              onClick={() => setShowNewService(true)}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Nuevo servicio
            </button>
          }
        />

        <section className="mt-6 space-y-4">
          {serviceSheets.map(({ appointment, branch, customer, groomer, groomingRecord, pet, services }) => {
            const elapsedMinutes = minutesBetween(groomingRecord?.actualStart, groomingRecord?.actualEnd);

            return (
              <article key={appointment.id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-panel">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="flex gap-3">
                    {pet.profilePhotoUrl ? (
                      <Image
                        src={pet.profilePhotoUrl}
                        alt={`Foto de ${pet.name}`}
                        width={72}
                        height={72}
                        className="h-[72px] w-[72px] shrink-0 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-lg bg-cloud text-jade">
                        <UserRound className="h-8 w-8" aria-hidden="true" />
                      </div>
                    )}
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-semibold text-ink">{pet.name}</h2>
                        <StatusPill status={appointment.status} />
                      </div>
                      <p className="mt-1 text-sm text-slate-500">
                        {customer?.name} · {customer?.phone} · {branch.name}
                      </p>
                      <p className="mt-2 text-sm font-semibold text-ink">
                        {services.map((service) => service.name).join(", ")}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {formatGuatemalaDateTime(appointment.scheduledStart)} · {groomer.name}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-2 text-sm text-slate-600 sm:grid-cols-3 xl:w-[28rem]">
                    <p className="rounded-lg bg-cloud p-3">
                      <span className="block text-xs font-semibold uppercase text-slate-500">Inicio real</span>
                      {groomingRecord?.actualStart ? formatGuatemalaDateTime(groomingRecord.actualStart) : "Pendiente"}
                    </p>
                    <p className="rounded-lg bg-cloud p-3">
                      <span className="block text-xs font-semibold uppercase text-slate-500">Fin real</span>
                      {groomingRecord?.actualEnd ? formatGuatemalaDateTime(groomingRecord.actualEnd) : "Pendiente"}
                    </p>
                    <p className="rounded-lg bg-cloud p-3">
                      <span className="block text-xs font-semibold uppercase text-slate-500">Duracion</span>
                      {elapsedMinutes ? `${elapsedMinutes} min` : "Pendiente"}
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                  <div className="space-y-3">
                    <div className="rounded-lg border border-slate-200 bg-cloud/40 p-4 text-sm text-slate-700">
                      <p className="font-semibold text-ink">Indicaciones del dueño</p>
                      <p className="mt-1">{appointment.notes}</p>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-lg border border-slate-200 p-4 text-sm text-slate-700">
                        <p className="font-semibold text-ink">Notas del groomer</p>
                        <p className="mt-1">{groomingRecord?.groomerNotes || "Sin notas todavia."}</p>
                      </div>
                      <div className="rounded-lg border border-slate-200 p-4 text-sm text-slate-700">
                        <p className="font-semibold text-ink">Resultado</p>
                        <p className="mt-1">{groomingRecord?.outcome || "Pendiente de completar."}</p>
                      </div>
                    </div>
                    {groomingRecord?.satisfactionNotes && (
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                        <p className="font-semibold">Conformidad final</p>
                        <p className="mt-1">{groomingRecord.satisfactionNotes}</p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <SignatureStatus
                        imageUrl={groomingRecord?.intakeSignatureImageUrl}
                        label="Entregado por dueño"
                        name={groomingRecord?.intakeSignatureName}
                        signedAt={groomingRecord?.intakeSignedAt}
                      />
                      <SignatureStatus
                        imageUrl={groomingRecord?.completionSignatureImageUrl}
                        label="Conforme al finalizar"
                        name={groomingRecord?.completionSignatureName}
                        signedAt={groomingRecord?.completionSignedAt}
                      />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <PhotoSlot label="Antes" photoUrl={groomingRecord?.beforePhotoUrl} />
                      <PhotoSlot label="Despues" photoUrl={groomingRecord?.afterPhotoUrl} />
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
        {showNewService && (
          <NewServiceModal data={data} onClose={() => setShowNewService(false)} onCreate={setData} />
        )}
      </PageContainer>
    </AppShell>
  );
}
