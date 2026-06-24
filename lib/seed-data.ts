import type { AppData } from "./types";

export const appData: AppData = {
  branches: [
    {
      id: "branch-z10",
      name: "Sucursal Zona 10",
      address: "14 Calle 5-20, Zona 10, Ciudad de Guatemala",
      phone: "+502 2420 1100",
      active: true
    },
    {
      id: "branch-antigua",
      name: "Sucursal Antigua",
      address: "5a Avenida Norte 18, Antigua Guatemala",
      phone: "+502 7832 4500",
      active: true
    }
  ],
  users: [
    {
      id: "user-maria",
      name: "Maria Lopez",
      email: "maria@petstore.gt",
      phone: "+502 5550 1001",
      role: "manager",
      branchIds: ["branch-z10", "branch-antigua"],
      active: true
    },
    {
      id: "user-ana",
      name: "Ana Perez",
      email: "ana@petstore.gt",
      phone: "+502 5550 1002",
      role: "staff",
      branchIds: ["branch-z10"],
      active: true
    },
    {
      id: "user-luis",
      name: "Luis Garcia",
      email: "luis@petstore.gt",
      phone: "+502 5550 1003",
      role: "groomer",
      branchIds: ["branch-z10"],
      active: true
    },
    {
      id: "user-sofia",
      name: "Sofia Morales",
      email: "sofia@petstore.gt",
      phone: "+502 5550 1004",
      role: "groomer",
      branchIds: ["branch-antigua"],
      active: true
    },
    {
      id: "user-carlos",
      name: "Carlos Mejia",
      email: "carlos@petstore.gt",
      phone: "+502 5550 1005",
      role: "staff",
      branchIds: ["branch-antigua"],
      active: true
    }
  ],
  customers: [
    {
      id: "customer-1",
      name: "Valeria Castillo",
      phone: "+502 4100 2233",
      whatsappOptIn: true,
      notes: "Prefiere mensajes por WhatsApp por la tarde."
    },
    {
      id: "customer-2",
      name: "Roberto Chacon",
      phone: "+502 5200 8899",
      whatsappOptIn: true,
      notes: "Cliente frecuente de banos medicados."
    },
    {
      id: "customer-3",
      name: "Andrea Diaz",
      phone: "+502 3001 7788",
      whatsappOptIn: false,
      notes: "Confirmar por llamada."
    }
  ],
  pets: [
    {
      id: "pet-luna",
      customerId: "customer-1",
      name: "Luna",
      species: "perro",
      breed: "Schnauzer",
      size: "mediano",
      birthdate: "2021-04-18",
      healthNotes: "Piel sensible; usar shampoo hipoalergenico.",
      behaviorNotes: "Nerviosa con secadora, usar pausas cortas."
    },
    {
      id: "pet-max",
      customerId: "customer-2",
      name: "Max",
      species: "perro",
      breed: "Golden Retriever",
      size: "grande",
      ageEstimate: "5 anos",
      healthNotes: "Revisar orejas por historial de infeccion.",
      behaviorNotes: "Amigable, tolera bien corte de unas."
    },
    {
      id: "pet-misha",
      customerId: "customer-3",
      name: "Misha",
      species: "gato",
      breed: "Domestico pelo largo",
      size: "pequeno",
      ageEstimate: "3 anos",
      healthNotes: "Sin alergias reportadas.",
      behaviorNotes: "Requiere manejo tranquilo; no le gusta el cepillado de cola."
    }
  ],
  services: [
    {
      id: "service-basic",
      name: "Bano y cepillado",
      estimatedDurationMinutes: 60,
      active: true
    },
    {
      id: "service-full",
      name: "Grooming completo",
      estimatedDurationMinutes: 120,
      active: true
    },
    {
      id: "service-nails",
      name: "Corte de unas",
      estimatedDurationMinutes: 20,
      active: true
    },
    {
      id: "service-medicated",
      name: "Bano medicado",
      estimatedDurationMinutes: 75,
      active: true
    }
  ],
  appointments: [
    {
      id: "appt-1",
      branchId: "branch-z10",
      petId: "pet-luna",
      groomerId: "user-luis",
      serviceIds: ["service-full"],
      scheduledStart: "2026-06-23T09:00:00-06:00",
      scheduledEnd: "2026-06-23T11:00:00-06:00",
      status: "completed",
      source: "whatsapp",
      notes: "Cliente pidio corte estilo schnauzer clasico.",
      createdById: "user-ana"
    },
    {
      id: "appt-2",
      branchId: "branch-z10",
      petId: "pet-max",
      groomerId: "user-luis",
      serviceIds: ["service-medicated", "service-nails"],
      scheduledStart: "2026-06-23T13:00:00-06:00",
      scheduledEnd: "2026-06-23T14:35:00-06:00",
      status: "confirmed",
      source: "phone",
      notes: "Traer shampoo medicado recomendado por veterinaria.",
      createdById: "user-ana"
    },
    {
      id: "appt-3",
      branchId: "branch-antigua",
      petId: "pet-misha",
      groomerId: "user-sofia",
      serviceIds: ["service-basic"],
      scheduledStart: "2026-06-23T10:30:00-06:00",
      scheduledEnd: "2026-06-23T11:30:00-06:00",
      status: "in_progress",
      source: "walk_in",
      notes: "Cepillado cuidadoso, no rasurar.",
      createdById: "user-carlos"
    },
    {
      id: "appt-4",
      branchId: "branch-antigua",
      petId: "pet-luna",
      groomerId: "user-sofia",
      serviceIds: ["service-basic"],
      scheduledStart: "2026-06-24T15:00:00-06:00",
      scheduledEnd: "2026-06-24T16:00:00-06:00",
      status: "scheduled",
      source: "online",
      notes: "Reserva de prueba para futuro portal publico.",
      createdById: "user-maria"
    }
  ],
  groomingRecords: [
    {
      id: "record-1",
      appointmentId: "appt-1",
      actualStart: "2026-06-23T09:05:00-06:00",
      actualEnd: "2026-06-23T10:55:00-06:00",
      groomerNotes: "Buen comportamiento. Se recomienda cepillado semanal.",
      outcome: "Corte completo terminado sin incidentes.",
      beforePhotoUrl: "",
      afterPhotoUrl: ""
    },
    {
      id: "record-3",
      appointmentId: "appt-3",
      actualStart: "2026-06-23T10:35:00-06:00",
      groomerNotes: "Misha esta tolerando bien el cepillado con pausas.",
      outcome: "En progreso.",
      beforePhotoUrl: "",
      afterPhotoUrl: ""
    }
  ],
  reminderLogs: [
    {
      id: "reminder-1",
      appointmentId: "appt-2",
      channel: "whatsapp",
      messageTemplate:
        "Hola Roberto, le recordamos la cita de grooming de Max para Bano medicado, Corte de unas en Sucursal Zona 10, mar, 23 jun, 13:00. Responda CONFIRMAR para confirmar o REPROGRAMAR si necesita otra hora.",
      manualStatus: "drafted",
      timestamp: "2026-06-22T16:00:00-06:00"
    }
  ]
};
