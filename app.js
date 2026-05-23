const apiBase = '';

const serviceSelect = document.getElementById('serviceSelect');
const offerSelect = document.getElementById('offerSelect');
const professionalSelect = document.getElementById('professionalSelect');
const appointmentDate = document.getElementById('appointmentDate');
const timeSelect = document.getElementById('timeSelect');
const bookingForm = document.getElementById('bookingForm');
const nameInput = document.getElementById('clientName');
const phoneInput = document.getElementById('clientPhone');
const servicesGrid = document.getElementById('servicesGrid');
const offersGrid = document.getElementById('offersGrid');
const availabilityContainer = document.getElementById('availabilityContainer');
const appointmentsList = document.getElementById('appointmentsList');
const formMessage = document.getElementById('formMessage');

let services = [];
let offers = [];
let professionals = [];

async function fetchJson(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, options);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Erro ${response.status}`);
  }
  return response.json();
}

async function loadServices() {
  try {
    services = await fetchJson('/services');
    serviceSelect.innerHTML = '<option value="">Selecione um serviço</option>';
    services.forEach(service => {
      const option = document.createElement('option');
      option.value = service._id;
      option.textContent = `${service.name} - R$ ${service.price.toFixed(2).replace('.', ',')}`;
      serviceSelect.appendChild(option);
    });

    servicesGrid.innerHTML = services.map(service => `
      <div class="card">
        <h3>${service.name}</h3>
        <small>${service.description || 'Serviço premium personalizado'}</small>
        <strong>R$ ${service.price.toFixed(2).replace('.', ',')}</strong>
      </div>
    `).join('');
  } catch (error) {
    console.error('Falha ao carregar serviços:', error);
  }
}

async function loadOffers() {
  try {
    offers = await fetchJson('/offers');
    offerSelect.innerHTML = '<option value="">Selecione uma oferta</option>';
    offers.forEach(offer => {
      const option = document.createElement('option');
      option.value = offer._id;
      option.textContent = `${offer.title} - R$ ${offer.price.toFixed(2).replace('.', ',')}`;
      offerSelect.appendChild(option);
    });

    offersGrid.innerHTML = offers.map(offer => `
      <div class="card">
        <h3>${offer.title}</h3>
        <small>${offer.description || 'Pacote especial'}</small>
        <strong>R$ ${offer.price.toFixed(2).replace('.', ',')}</strong>
      </div>
    `).join('');
  } catch (error) {
    console.error('Falha ao carregar ofertas:', error);
  }
}

async function loadProfessionals() {
  try {
    professionals = await fetchJson('/professionals');
    professionalSelect.innerHTML = '<option value="">Escolha um profissional</option>';
    professionals.forEach(professional => {
      const option = document.createElement('option');
      option.value = professional._id;
      option.textContent = `${professional.name} ${professional.specialization ? `- ${professional.specialization}` : ''}`;
      professionalSelect.appendChild(option);
    });
  } catch (error) {
    console.error('Falha ao carregar profissionais:', error);
  }
}

function generateTimeOptions(start = '09:00', end = '19:00', interval = 30) {
  const times = [];
  const [startHour, startMinute] = start.split(':').map(Number);
  const [endHour, endMinute] = end.split(':').map(Number);
  let minutes = startHour * 60 + startMinute;
  const endTotal = endHour * 60 + endMinute;

  while (minutes <= endTotal) {
    const hour = String(Math.floor(minutes / 60)).padStart(2, '0');
    const minute = String(minutes % 60).padStart(2, '0');
    times.push(`${hour}:${minute}`);
    minutes += interval;
  }

  return times;
}

function setAvailabilitySlots(slots) {
  const allSlots = generateTimeOptions('09:00', '19:00', 30);
  timeSelect.innerHTML = '<option value="">Selecione um horário</option>';
  availabilityContainer.innerHTML = '';

  if (!slots || slots.length === 0) {
    availabilityContainer.innerHTML = '<div class="alert">Nenhum horário disponível para a data selecionada.</div>';
    allSlots.forEach(slot => {
      const option = document.createElement('option');
      option.value = slot;
      option.textContent = `${slot} - Indisponível`;
      option.disabled = true;
      timeSelect.appendChild(option);
    });
    return;
  }

  const availableSet = new Set(slots);
  allSlots.forEach(slot => {
    const option = document.createElement('option');
    option.value = slot;
    option.textContent = slot;
    if (!availableSet.has(slot)) {
      option.disabled = true;
      option.textContent = `${slot} - Indisponível`;
    }
    timeSelect.appendChild(option);

    if (availableSet.has(slot)) {
      const card = document.createElement('div');
      card.className = 'slot';
      card.textContent = slot;
      availabilityContainer.appendChild(card);
    }
  });
}

async function fetchAvailability() {
  const professionalId = professionalSelect.value;
  const serviceId = serviceSelect.value;
  const offerId = offerSelect.value;
  const dateValue = appointmentDate.value;

  if (!professionalId || !dateValue || (!serviceId && !offerId)) {
    setAvailabilitySlots([]);
    return;
  }

  const query = new URLSearchParams({ professionalId, date: dateValue });
  if (offerId) query.set('offerId', offerId);
  else query.set('serviceId', serviceId);

  try {
    const response = await fetchJson(`/availability?${query.toString()}`);
    const timeSlots = response.availability?.[0]?.slots || [];
    setAvailabilitySlots(timeSlots);
  } catch (error) {
    console.error('Falha ao buscar disponibilidade:', error);
    setAvailabilitySlots([]);
  }
}

bookingForm.addEventListener('submit', async event => {
  event.preventDefault();
  formMessage.style.display = 'none';
  const name = document.getElementById('clientName').value.trim();
  const phone = document.getElementById('clientPhone').value.trim();
  const email = document.getElementById('clientEmail').value.trim();
  const serviceId = serviceSelect.value;
  const offerId = offerSelect.value;
  const professionalId = professionalSelect.value;
  const dateValue = appointmentDate.value;
  const hour = timeSelect.value;
  const notes = document.getElementById('notes').value.trim();

  if (!name || !phone || !professionalId || !dateValue || !hour || (!serviceId && !offerId)) {
    showMessage('Preencha todos os campos obrigatórios antes de enviar.', true);
    return;
  }

  if (/[0-9]/.test(name)) {
    showMessage('Nome não pode conter números.', true);
    return;
  }

  if (/[^0-9+()\s-]/.test(phone)) {
    showMessage('Telefone só pode conter números e símbolos de formatação.', true);
    return;
  }

  if (serviceId && offerId) {
    showMessage('Selecione apenas um serviço ou uma oferta por agendamento.', true);
    return;
  }

  try {
    const client = await fetchJson('/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, email })
    });

    const datetime = new Date(`${dateValue}T${hour}:00`).toISOString();
    await fetchJson('/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        professionalId,
        clientId: client._id,
        serviceId: serviceId || undefined,
        offerId: offerId || undefined,
        datetime,
        notes
      })
    });

    showMessage('Agendamento criado com sucesso! Entraremos em contato em breve.', false);
    bookingForm.reset();
    offerSelect.selectedIndex = 0;
    timeSelect.innerHTML = '<option value="">Selecione uma data</option>';
    availabilityContainer.innerHTML = '';
    loadAppointments();
  } catch (error) {
    console.error('Erro ao criar agendamento:', error);
    showMessage('Não foi possível concluir o agendamento. Tente novamente mais tarde.', true);
  }
});

function showMessage(message, isError) {
  formMessage.textContent = message;
  formMessage.style.display = 'block';
  formMessage.style.background = isError ? '#fbe7e4' : '#eaf7eb';
  formMessage.style.borderColor = isError ? 'rgba(214, 91, 72, 0.3)' : 'rgba(87, 163, 103, 0.25)';
  formMessage.style.color = isError ? '#7f3a33' : '#264f2f';
}

function renderAppointments(appointments) {
  if (!appointments || appointments.length === 0) {
    appointmentsList.innerHTML = '<div class="card"><p>Nenhum agendamento futuro encontrado.</p></div>';
    return;
  }

  appointmentsList.innerHTML = appointments.map(appt => {
    const serviceName = appt.offer ? appt.offer.title : appt.service ? appt.service.name : 'Serviço';
    const dt = new Date(appt.datetime);
    const date = dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const time = dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    return `
      <div class="card">
        <h3>${serviceName}</h3>
        <small>${appt.professional.name} - ${appt.client.name}</small>
        <p>${date} às ${time}</p>
        <p>R$ ${appt.price.toFixed(2).replace('.', ',')}</p>
        <button class="button cancel-button" data-id="${appt._id}">Cancelar</button>
      </div>
    `;
  }).join('');

  document.querySelectorAll('.cancel-button').forEach(button => {
    button.addEventListener('click', async () => {
      const appointmentId = button.dataset.id;
      try {
        await fetchJson(`/appointments/${appointmentId}/cancel`, { method: 'PATCH' });
        showMessage('Agendamento cancelado com sucesso.', false);
        loadAppointments();
      } catch (error) {
        console.error('Erro ao cancelar agendamento:', error);
        showMessage('Não foi possível cancelar o agendamento.', true);
      }
    });
  });
}

async function loadAppointments() {
  try {
    const appointments = await fetchJson('/appointments');
    const future = appointments
      .filter(appt => appt.status === 'scheduled' && new Date(appt.datetime) >= new Date())
      .sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
    renderAppointments(future);
  } catch (error) {
    console.error('Falha ao carregar agendamentos:', error);
    appointmentsList.innerHTML = '<div class="card"><p>Não foi possível carregar os agendamentos.</p></div>';
  }
}

serviceSelect.addEventListener('change', () => {
  if (serviceSelect.value) {
    offerSelect.value = '';
    offerSelect.disabled = true;
  } else {
    offerSelect.disabled = false;
  }
  fetchAvailability();
});

offerSelect.addEventListener('change', () => {
  if (offerSelect.value) {
    serviceSelect.value = '';
    serviceSelect.disabled = true;
  } else {
    serviceSelect.disabled = false;
  }
  fetchAvailability();
});

nameInput.addEventListener('input', () => {
  nameInput.value = nameInput.value.replace(/[0-9]/g, '');
});

phoneInput.addEventListener('input', () => {
  phoneInput.value = phoneInput.value.replace(/[^0-9+()\s-]/g, '');
});

professionalSelect.addEventListener('change', fetchAvailability);
appointmentDate.addEventListener('change', fetchAvailability);

window.addEventListener('DOMContentLoaded', async () => {
  const today = new Date().toISOString().slice(0, 10);
  appointmentDate.setAttribute('min', today);
  appointmentDate.value = today;
  await Promise.all([loadServices(), loadOffers(), loadProfessionals()]);
  await loadAppointments();
  fetchAvailability();
});
