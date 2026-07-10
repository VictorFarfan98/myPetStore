import type { AppData } from "./types";

export const appData: AppData = {
  branches: [
    {
      id: 1,
      name: "Sucursal Zona 11",
      address: "Plaza San Jorge, Zona 10, Ciudad de Guatemala",
      phone: "+502 2420 1100",
      active: true
    },
    {
      id: 2,
      name: "Sucursal Zona 15",
      address: "Plaza Comercial Punto 15, Antigua Guatemala",
      phone: "+502 7832 4500",
      active: true
    },
    {
      id: 3,
      name: "Sucursal CAES",
      address: "Carretera a El Salvador, Antigua Guatemala",
      phone: "+502 7832 4500",
      active: true
    },
    {
      id: 4,
      name: "Sucursal San Cristobal",
      address: "Plaza Comercial La Farfalla, San Cristobal",
      phone: "+502 7832 4500",
      active: true
    }
  ],
  users: [
    {
      id: 1,
      name: "Maria Lopez",
      email: "maria@petstore.gt",
      phone: "+502 5550 1001",
      role: "manager",
      branchIds: [1, 2, 3],
      active: true
    },
    {
      id: 2,
      name: "Ana Perez",
      email: "ana@petstore.gt",
      phone: "+502 5550 1002",
      role: "staff",
      branchIds: [1],
      active: true
    },
    {
      id: 3,
      name: "Luis Garcia",
      email: "luis@petstore.gt",
      phone: "+502 5550 1003",
      role: "groomer",
      branchIds: [1],
      active: true,
      calendarColor: "#0F766E"
    },
    {
      id: 4,
      name: "Sofia Morales",
      email: "sofia@petstore.gt",
      phone: "+502 5550 1004",
      role: "groomer",
      branchIds: [2],
      active: true,
      calendarColor: "#7C3AED"
    },
    {
      id: 5,
      name: "Carlos Mejia",
      email: "carlos@petstore.gt",
      phone: "+502 5550 1005",
      role: "staff",
      branchIds: [2],
      active: true
    }
  ],
  customers: [
    {
      id: 1,
      name: "Valeria Castillo",
      phone: "+502 4100 2233",
      whatsappOptIn: true,
      notes: "Prefiere mensajes por WhatsApp por la tarde."
    },
    {
      id: 2,
      name: "Roberto Chacon",
      phone: "+502 5200 8899",
      whatsappOptIn: true,
      notes: "Cliente frecuente de baños medicados."
    },
    {
      id: 3,
      name: "Andrea Diaz",
      phone: "+502 3001 7788",
      whatsappOptIn: false,
      notes: "Confirmar por llamada."
    }
  ],
  pets: [
    {
      id: 1,
      customerId: 1,
      name: "Luna",
      species: "perro",
      breed: "Schnauzer",
      size: "mediano",
      profilePhotoUrl: "https://images.unsplash.com/photo-1517423440428-a5a00ad493e8?auto=format&fit=crop&w=320&q=80",
      birthdate: "2021-04-18",
      healthNotes: "Piel sensible; usar shampoo hipoalergenico.",
      behaviorNotes: "Nerviosa con secadora, usar pausas cortas."
    },
    {
      id: 2,
      customerId: 2,
      name: "Max",
      species: "perro",
      breed: "Golden Retriever",
      size: "grande",
      profilePhotoUrl: "https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&w=320&q=80",
      ageEstimate: "5 anos",
      healthNotes: "Revisar orejas por historial de infeccion.",
      behaviorNotes: "Amigable, tolera bien corte de uñas."
    },
    {
      id: 3,
      customerId: 3,
      name: "Misha",
      species: "gato",
      breed: "Domestico pelo largo",
      size: "pequeno",
      profilePhotoUrl: "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=320&q=80",
      ageEstimate: "3 anos",
      healthNotes: "Sin alergias reportadas.",
      behaviorNotes: "Requiere manejo tranquilo; no le gusta el cepillado de cola."
    }
  ],
  services: [
    {
      id: 1,
      name: "Baño y cepillado",
      estimatedDurationMinutes: 60,
      active: true
    },
    {
      id: 2,
      name: "Grooming completo",
      estimatedDurationMinutes: 120,
      active: true
    },
    {
      id: 3,
      name: "Corte de uñas",
      estimatedDurationMinutes: 20,
      active: true
    },
    {
      id: 4,
      name: "Baño medicado",
      estimatedDurationMinutes: 75,
      active: true
    }
  ],
  appointments: [
    {
      id: 1,
      branchId: 1,
      petId: 1,
      groomerId: 3,
      serviceIds: [2],
      scheduledStart: "2026-06-23T09:00:00-06:00",
      scheduledEnd: "2026-06-23T11:00:00-06:00",
      status: "completed",
      source: "whatsapp",
      notes: "Cliente pidio corte estilo schnauzer clasico.",
      createdById: 2
    },
    {
      id: 2,
      branchId: 1,
      petId: 2,
      groomerId: 3,
      serviceIds: [4, 3],
      scheduledStart: "2026-06-23T13:00:00-06:00",
      scheduledEnd: "2026-06-23T14:35:00-06:00",
      status: "confirmed",
      source: "phone",
      notes: "Traer shampoo medicado recomendado por veterinaria.",
      createdById: 2
    },
    {
      id: 3,
      branchId: 2,
      petId: 3,
      groomerId: 4,
      serviceIds: [1],
      scheduledStart: "2026-06-23T10:30:00-06:00",
      scheduledEnd: "2026-06-23T11:30:00-06:00",
      status: "in_progress",
      source: "walk_in",
      notes: "Cepillado cuidadoso, no rasurar.",
      createdById: 5
    },
    {
      id: 4,
      branchId: 2,
      petId: 1,
      groomerId: 4,
      serviceIds: [1],
      scheduledStart: "2026-06-24T15:00:00-06:00",
      scheduledEnd: "2026-06-24T16:00:00-06:00",
      status: "scheduled",
      source: "online",
      notes: "Reserva de prueba para futuro portal publico.",
      createdById: 1
    }
  ],
  groomingRecords: [
    {
      id: 1,
      appointmentId: 1,
      actualStart: "2026-06-23T09:05:00-06:00",
      actualEnd: "2026-06-23T10:55:00-06:00",
      groomerNotes: "Buen comportamiento. Se recomienda cepillado semanal.",
      outcome: "Corte completo terminado sin incidentes.",
      intakeSignatureName: "Valeria Castillo",
      intakeSignedAt: "2026-06-23T09:02:00-06:00",
      completionSignatureName: "Valeria Castillo",
      completionSignedAt: "2026-06-23T11:04:00-06:00",
      satisfactionNotes: "Dueño conforme con largo, limpieza y trato recibido.",
      beforePhotoUrl: "https://images.unsplash.com/photo-1600804340584-c7db2eacf0bf?auto=format&fit=crop&w=640&q=80",
      afterPhotoUrl: "https://images.unsplash.com/photo-1516734212186-a967f81ad0d7?auto=format&fit=crop&w=640&q=80"
    },
    {
      id: 2,
      appointmentId: 3,
      actualStart: "2026-06-23T10:35:00-06:00",
      groomerNotes: "Misha esta tolerando bien el cepillado con pausas.",
      outcome: "En progreso.",
      intakeSignatureName: "Andrea Diaz",
      intakeSignedAt: "2026-06-23T10:28:00-06:00",
      satisfactionNotes: "",
      beforePhotoUrl: "https://images.unsplash.com/photo-1513245543132-31f507417b26?auto=format&fit=crop&w=640&q=80",
      afterPhotoUrl: ""
    }
  ],
  reminderLogs: [
    {
      id: 1,
      appointmentId: 2,
      channel: "whatsapp",
      messageTemplate:
        "Hola Roberto, le recordamos la cita de grooming de Max para Baño medicado, Corte de uñas en Sucursal Zona 10, mar, 23 jun, 13:00. Responda CONFIRMAR para confirmar o REPROGRAMAR si necesita otra hora.",
      manualStatus: "drafted",
      timestamp: "2026-06-22T16:00:00-06:00"
    }
  ]
};
