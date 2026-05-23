require('dotenv').config();
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/pex';

const professionalSchema = new mongoose.Schema({
  name: { type: String, required: true },
  specialization: String,
  workingHours: [
    {
      dayOfWeek: { type: Number, min: 0, max: 6, required: true },
      from: { type: String, required: true },
      to: { type: String, required: true }
    }
  ],
  createdAt: { type: Date, default: Date.now }
});

const serviceSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  price: { type: Number, required: true },
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

const clientSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: String,
  phone: String,
  notes: String,
  createdAt: { type: Date, default: Date.now }
});

const offerSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  services: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Service' }],
  price: { type: Number, required: true },
  validUntil: Date,
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

const DEFAULT_APPOINTMENT_LENGTH = 60;

const appointmentSchema = new mongoose.Schema({
  professional: { type: mongoose.Schema.Types.ObjectId, ref: 'Professional', required: true },
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  service: { type: mongoose.Schema.Types.ObjectId, ref: 'Service' },
  offer: { type: mongoose.Schema.Types.ObjectId, ref: 'Offer' },
  datetime: { type: Date, required: true },
  duration: { type: Number, required: true, default: DEFAULT_APPOINTMENT_LENGTH },
  price: { type: Number, required: true },
  status: { type: String, enum: ['scheduled', 'cancelled', 'completed'], default: 'scheduled' },
  notes: String,
  notified: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

const Professional = mongoose.model('Professional', professionalSchema);
const Service = mongoose.model('Service', serviceSchema);
const Client = mongoose.model('Client', clientSchema);
const Offer = mongoose.model('Offer', offerSchema);
const Appointment = mongoose.model('Appointment', appointmentSchema);

const professionals = [
  {
    name: 'João',
    specialization: 'Corte e estilo',
    workingHours: [
      { dayOfWeek: 1, from: '09:00', to: '18:00' },
      { dayOfWeek: 2, from: '09:00', to: '18:00' },
      { dayOfWeek: 3, from: '09:00', to: '18:00' },
      { dayOfWeek: 4, from: '09:00', to: '18:00' },
      { dayOfWeek: 5, from: '09:00', to: '18:00' },
      { dayOfWeek: 6, from: '09:00', to: '14:00' }
    ]
  },
  {
    name: 'Maria',
    specialization: 'Coloração e corte feminino',
    workingHours: [
      { dayOfWeek: 1, from: '10:00', to: '19:00' },
      { dayOfWeek: 2, from: '10:00', to: '19:00' },
      { dayOfWeek: 4, from: '10:00', to: '19:00' },
      { dayOfWeek: 5, from: '10:00', to: '19:00' },
      { dayOfWeek: 6, from: '09:00', to: '15:00' }
    ]
  },
  {
    name: 'Walquiria',
    specialization: 'Especialista',
    workingHours: [
      { dayOfWeek: 1, from: '10:00', to: '19:00' },
      { dayOfWeek: 2, from: '10:00', to: '19:00' },
      { dayOfWeek: 4, from: '10:00', to: '19:00' },
      { dayOfWeek: 5, from: '10:00', to: '19:00' }
    ]
  }
];

const services = [
  { name: 'Corte de cabelo', description: 'Corte personalizado com acabamento', price: 35 },
  { name: 'Barba', description: 'Aparar e modelar barba', price: 45 },
  { name: 'Coloração express', description: 'Coloração rápida com produto profissional', price: 55 }
];

const clients = [
  { name: 'Ana Souza', email: 'ana@example.com', phone: '+5511999998888' },
  { name: 'Lucas Lima', email: 'lucas@example.com', phone: '+5511988887777' }
];

async function run() {
  try {
    await mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Conectado ao MongoDB:', MONGODB_URI);

    await Promise.all([
      Professional.deleteMany({}),
      Service.deleteMany({}),
      Client.deleteMany({}),
      Offer.deleteMany({}),
      Appointment.deleteMany({})
    ]);

    const createdProfessionals = await Professional.insertMany(professionals);
    const createdServices = await Service.insertMany(services);
    const createdClients = await Client.insertMany(clients);

    const offers = [
      {
        title: 'Combo Corte + Barba',
        description: 'Serviço completo com corte e barba por preço especial',
        services: [createdServices[0]._id, createdServices[1]._id],
        price: 110,
        validUntil: new Date('2026-12-31')
      },
      {
        title: 'Oferta Color Boost',
        description: 'Coloração express com hidratação leve',
        services: [createdServices[2]._id],
        price: 140,
        validUntil: new Date('2026-12-31')
      }
    ];

    const createdOffers = await Offer.insertMany(offers);

    const appointments = [
      {
        professional: createdProfessionals[0]._id,
        client: createdClients[0]._id,
        service: createdServices[0]._id,
        datetime: new Date('2026-05-20T10:00:00Z'),
        price: createdServices[0].price,
        notes: 'Corte com acabamento e texturização'
      },
      {
        professional: createdProfessionals[0]._id,
        client: createdClients[1]._id,
        offer: createdOffers[0]._id,
        datetime: new Date('2026-05-21T14:30:00Z'),
        price: createdOffers[0].price,
        notes: 'Combo corte e barba para evento'
      },
      {
        professional: createdProfessionals[1]._id,
        client: createdClients[0]._id,
        service: createdServices[2]._id,
        datetime: new Date('2026-05-22T18:00:00Z'),
        price: createdServices[2].price,
        notes: 'Coloração rápida com retoque'
      }
    ];

    const inserted = await Appointment.insertMany(appointments);
    console.log('Professionals:', createdProfessionals.length);
    console.log('Services:', createdServices.length);
    console.log('Clients:', createdClients.length);
    console.log('Offers:', createdOffers.length);
    console.log('Appointments:', inserted.length);

    await mongoose.disconnect();
    console.log('Seed concluído.');
  } catch (err) {
    console.error('Erro no seed:', err);
    process.exit(1);
  }
}

if (require.main === module) run();
