require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
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
	status: {
		type: String,
		enum: ['scheduled', 'cancelled', 'completed'],
		default: 'scheduled'
	},
	notes: String,
	notified: { type: Boolean, default: false },
	createdAt: { type: Date, default: Date.now }
});

const Professional = mongoose.model('Professional', professionalSchema);
const Service = mongoose.model('Service', serviceSchema);
const Client = mongoose.model('Client', clientSchema);
const Offer = mongoose.model('Offer', offerSchema);
const Appointment = mongoose.model('Appointment', appointmentSchema);

function timeStringToMinutes(time) {
	const [hours, minutes] = time.split(':').map(Number);
	return hours * 60 + minutes;
}

function minutesToTime(minutes) {
	const hours = String(Math.floor(minutes / 60)).padStart(2, '0');
	const mins = String(minutes % 60).padStart(2, '0');
	return `${hours}:${mins}`;
}

function overlaps(start, end, bookings) {
	return bookings.some(slot => start < slot.end && end > slot.start);
}

function buildAvailableSlots(from, to, duration, bookings) {
	const slots = [];
	for (let start = from; start + duration <= to; start += 30) {
		if (!overlaps(start, start + duration, bookings)) {
			slots.push(minutesToTime(start));
		}
	}
	return slots;
}

app.get('/', (req, res) => {
	res.json({ message: 'Servidor de agendamento do cabeleireiro ativo' });
});

app.get('/professionals', async (req, res) => {
	const pros = await Professional.find().lean();
	res.json(pros);
});

app.post('/professionals', async (req, res) => {
	try {
		const prof = await Professional.create(req.body);
		res.status(201).json(prof);
	} catch (err) {
		res.status(400).json({ error: err.message });
	}
});

app.get('/clients', async (req, res) => {
	const clients = await Client.find().lean();
	res.json(clients);
});

app.post('/clients', async (req, res) => {
	try {
		const { email, phone, name } = req.body;
		let client;
		if (email || phone) {
			client = await Client.findOne({
				$or: [
					...(email ? [{ email }] : []),
					...(phone ? [{ phone }] : [])
				]
			});
		}
		if (!client) {
			client = await Client.create({ name, email, phone });
		}
		res.status(201).json(client);
	} catch (err) {
		res.status(400).json({ error: err.message });
	}
});

app.get('/services', async (req, res) => {
	const services = await Service.find({ active: true }).lean();
	res.json(services);
});

app.post('/services', async (req, res) => {
	try {
		const service = await Service.create(req.body);
		res.status(201).json(service);
	} catch (err) {
		res.status(400).json({ error: err.message });
	}
});

app.get('/offers', async (req, res) => {
	const offers = await Offer.find({ active: true }).populate('services').lean();
	res.json(offers);
});

app.post('/offers', async (req, res) => {
	try {
		const offer = await Offer.create(req.body);
		res.status(201).json(offer);
	} catch (err) {
		res.status(400).json({ error: err.message });
	}
});

app.get('/appointments', async (req, res) => {
	const appts = await Appointment.find()
		.populate('professional client service offer')
		.sort({ datetime: 1 })
		.lean();
	res.json(appts);
});

app.post('/appointments', async (req, res) => {
	try {
		const { professionalId, clientId, serviceId, offerId, datetime, notes } = req.body;
		if (!professionalId || !clientId || !datetime) {
			return res.status(400).json({ error: 'Campos obrigatórios: professionalId, clientId, datetime' });
		}
		if (!serviceId && !offerId) {
			return res.status(400).json({ error: 'Informe serviceId ou offerId para o agendamento' });
		}

		const professional = await Professional.findById(professionalId);
		const client = await Client.findById(clientId);
		if (!professional || !client) {
			return res.status(404).json({ error: 'Profissional ou cliente não encontrado' });
		}

		let service;
		let offer;
		let duration;
		let price;

		if (offerId) {
			offer = await Offer.findById(offerId).populate('services');
			if (!offer) return res.status(404).json({ error: 'Oferta não encontrada' });
			price = offer.price;
			duration = offer.services.length * DEFAULT_APPOINTMENT_LENGTH;
		} else {
			service = await Service.findById(serviceId);
			if (!service) return res.status(404).json({ error: 'Serviço não encontrado' });
			price = service.price;
			duration = DEFAULT_APPOINTMENT_LENGTH;
		}

		const appt = new Appointment({
			professional: professional._id,
			client: client._id,
			service: service ? service._id : undefined,
			offer: offer ? offer._id : undefined,
			datetime: new Date(datetime),
			duration,
			price,
			notes
		});

		await appt.save();
		await appt.populate('professional client service offer');
		res.status(201).json(appt);
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

app.get('/search', async (req, res) => {
	try {
		const { q, professionalId, clientId, serviceId, status, dateFrom, dateTo } = req.query;
		const query = {};

		if (professionalId) query.professional = professionalId;
		if (clientId) query.client = clientId;
		if (serviceId) query.service = serviceId;
		if (status) query.status = status;
		if (dateFrom || dateTo) query.datetime = {};
		if (dateFrom) query.datetime.$gte = new Date(dateFrom);
		if (dateTo) query.datetime.$lte = new Date(dateTo);

		if (q) {
			const regex = new RegExp(q, 'i');
			const matchingClients = await Client.find({ name: regex }).select('_id').lean();
			const matchingProfessionals = await Professional.find({ name: regex }).select('_id').lean();
			const matchingServices = await Service.find({ name: regex }).select('_id').lean();
			const matchingOffers = await Offer.find({ title: regex }).select('_id').lean();

			query.$or = [
				{ notes: regex },
				{ professional: { $in: matchingProfessionals.map(item => item._id) } },
				{ client: { $in: matchingClients.map(item => item._id) } },
				{ service: { $in: matchingServices.map(item => item._id) } },
				{ offer: { $in: matchingOffers.map(item => item._id) } }
			];
		}

		const results = await Appointment.find(query)
			.populate('professional client service offer')
			.sort({ datetime: 1 })
			.lean();
		res.json(results);
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

app.get('/calendar', async (req, res) => {
	try {
		const { professionalId, start, end } = req.query;
		const query = { status: 'scheduled' };
		if (professionalId) query.professional = professionalId;

		const startDate = start ? new Date(start) : new Date();
		startDate.setHours(0, 0, 0, 0);
		const endDate = end ? new Date(end) : new Date(startDate);
		if (!end) endDate.setDate(endDate.getDate() + 30);
		endDate.setHours(23, 59, 59, 999);

		query.datetime = { $gte: startDate, $lte: endDate };

		const appts = await Appointment.find(query)
			.populate('professional client service offer')
			.sort({ datetime: 1 })
			.lean();

		const calendar = {};
		for (const appt of appts) {
			const day = new Date(appt.datetime).toISOString().slice(0, 10);
			if (!calendar[day]) calendar[day] = [];
			calendar[day].push(appt);
		}

		res.json({ professionalId: professionalId || null, start: startDate.toISOString(), end: endDate.toISOString(), calendar });
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

app.get('/appointments/:id', async (req, res) => {
	try {
		const appt = await Appointment.findById(req.params.id)
			.populate('professional client service offer')
			.lean();
		if (!appt) return res.status(404).json({ error: 'Agendamento não encontrado' });
		res.json(appt);
	} catch (err) {
		res.status(400).json({ error: 'ID inválido' });
	}
});

app.patch('/appointments/:id/cancel', async (req, res) => {
	try {
		const appt = await Appointment.findByIdAndUpdate(
			req.params.id,
			{ status: 'cancelled' },
			{ new: true }
		)
			.populate('professional client service offer')
			.lean();
		if (!appt) return res.status(404).json({ error: 'Agendamento não encontrado' });
		res.json(appt);
	} catch (err) {
		res.status(400).json({ error: err.message });
	}
});

app.put('/appointments/:id', async (req, res) => {
	try {
		const { datetime, notes, status } = req.body;
		const update = { datetime: datetime ? new Date(datetime) : undefined, notes, status };
		Object.keys(update).forEach(key => update[key] === undefined && delete update[key]);
		const appt = await Appointment.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true })
			.populate('professional client service offer')
			.lean();
		if (!appt) return res.status(404).json({ error: 'Agendamento não encontrado' });
		res.json(appt);
	} catch (err) {
		res.status(400).json({ error: err.message });
	}
});

app.get('/availability', async (req, res) => {
	try {
		const { professionalId, serviceId, offerId, date } = req.query;
		if (!professionalId || (!serviceId && !offerId)) {
			return res.status(400).json({ error: 'professionalId e serviceId ou offerId são obrigatórios' });
		}

		const professional = await Professional.findById(professionalId);
		if (!professional) return res.status(404).json({ error: 'Profissional não encontrado' });

		let duration = DEFAULT_APPOINTMENT_LENGTH;
		if (offerId) {
			const offer = await Offer.findById(offerId).populate('services');
			if (!offer) return res.status(404).json({ error: 'Oferta não encontrada' });
			duration = offer.services.length * DEFAULT_APPOINTMENT_LENGTH;
		} else {
			const service = await Service.findById(serviceId);
			if (!service) return res.status(404).json({ error: 'Serviço não encontrado' });
			duration = DEFAULT_APPOINTMENT_LENGTH;
		}

		const dates = [];
		if (date) {
			dates.push(new Date(date));
		} else {
			const today = new Date();
			today.setHours(0, 0, 0, 0);
			for (let i = 0; i < 7; i += 1) {
				const next = new Date(today);
				next.setDate(next.getDate() + i);
				dates.push(next);
			}
		}

		const availability = [];
		for (const target of dates) {
			const dayOfWeek = target.getDay();
			const schedule = professional.workingHours.find(item => item.dayOfWeek === dayOfWeek);
			if (!schedule) {
				availability.push({ date: target.toISOString().slice(0, 10), slots: [] });
				continue;
			}

			const dayStart = new Date(target);
			dayStart.setHours(0, 0, 0, 0);
			const dayEnd = new Date(dayStart);
			dayEnd.setDate(dayEnd.getDate() + 1);

			const appointments = await Appointment.find({
				professional: professional._id,
				status: 'scheduled',
				datetime: { $gte: dayStart, $lt: dayEnd }
			}).lean();

			const bookings = appointments.map(appt => {
				const startDate = new Date(appt.datetime);
				const start = timeStringToMinutes(`${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}`);
				return { start, end: start + appt.duration };
			});

			const from = timeStringToMinutes(schedule.from);
			const to = timeStringToMinutes(schedule.to);
			const slots = buildAvailableSlots(from, to, duration, bookings);
			availability.push({ date: target.toISOString().slice(0, 10), slots });
		}

		res.json({ professionalId, serviceId, availability });
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

app.get('/notifications/due', async (req, res) => {
	try {
		const hours = parseInt(req.query.hours, 10) || 24;
		const until = new Date(Date.now() + hours * 60 * 60 * 1000);
		const appointments = await Appointment.find({
			status: 'scheduled',
			notified: false,
			datetime: { $gte: new Date(), $lte: until }
		})
			.populate('client professional service offer')
			.lean();

		const reminders = appointments.map(appt => ({
			appointmentId: appt._id,
			client: appt.client,
			professional: appt.professional,
			service: appt.service || null,
			offer: appt.offer || null,
			datetime: appt.datetime,
			notes: appt.notes,
			message: `Lembrete: você tem um compromisso de ${appt.offer ? appt.offer.title : appt.service ? appt.service.name : 'serviço'} com ${appt.professional.name} em ${new Date(appt.datetime).toLocaleString()}`
		}));

		res.json(reminders);
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

app.post('/notifications/send', async (req, res) => {
	try {
		const hours = parseInt(req.query.hours, 10) || 24;
		const until = new Date(Date.now() + hours * 60 * 60 * 1000);
		const appointments = await Appointment.find({
			status: 'scheduled',
			notified: false,
			datetime: { $gte: new Date(), $lte: until }
		})
			.populate('client professional service offer')
			.lean();

		const reminders = appointments.map(appt => ({
			appointmentId: appt._id,
			client: appt.client,
			professional: appt.professional,
			message: `Lembrete enviado para ${appt.client.name}: compromisso com ${appt.professional.name} em ${new Date(appt.datetime).toLocaleString()}`
		}));

		await Appointment.updateMany(
			{ _id: { $in: appointments.map(appt => appt._id) } },
			{ notified: true }
		);

		res.json({ sent: reminders.length, reminders });
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
	.then(() => {
		app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
	})
	.catch(err => {
		console.error('Erro conectando ao MongoDB:', err.message);
		process.exit(1);
	});

