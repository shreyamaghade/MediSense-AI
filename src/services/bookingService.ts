export interface Doctor {
  id: string;
  name: string;
  specialty: string;
  availability: string[];
  rating: number;
  image: string;
}

export interface Appointment {
  doctorId: string;
  date: string;
  time: string;
  patientName: string;
  specialty: string;
}

const MOCK_DOCTORS: Doctor[] = [
  {
    id: '1',
    name: 'Dr. Sarah Jenkins',
    specialty: 'Cardiologist',
    availability: ['09:00 AM', '10:30 AM', '02:00 PM'],
    rating: 4.9,
    image: 'https://picsum.photos/seed/doc1/200/200'
  },
  {
    id: '2',
    name: 'Dr. Michael Chen',
    specialty: 'General Practitioner',
    availability: ['11:00 AM', '01:00 PM', '04:30 PM'],
    rating: 4.7,
    image: 'https://picsum.photos/seed/doc2/200/200'
  },
  {
    id: '3',
    name: 'Dr. Elena Rodriguez',
    specialty: 'Dermatologist',
    availability: ['08:30 AM', '12:00 PM', '03:00 PM'],
    rating: 4.8,
    image: 'https://picsum.photos/seed/doc3/200/200'
  },
  {
    id: '4',
    name: 'Dr. James Wilson',
    specialty: 'Neurologist',
    availability: ['10:00 AM', '01:30 PM', '04:00 PM'],
    rating: 4.6,
    image: 'https://picsum.photos/seed/doc4/200/200'
  },
  {
    id: '5',
    name: 'Dr. Priya Sharma',
    specialty: 'Pediatrician',
    availability: ['09:30 AM', '11:30 AM', '02:30 PM'],
    rating: 4.9,
    image: 'https://picsum.photos/seed/doc5/200/200'
  }
];

export async function getDoctorsBySpecialty(specialty: string): Promise<Doctor[]> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 800));
  
  // In a real app, this would be a fetch to /api/doctors?specialty=...
  const filtered = MOCK_DOCTORS.filter(d => 
    d.specialty.toLowerCase().includes(specialty.toLowerCase()) || 
    specialty.toLowerCase().includes(d.specialty.toLowerCase())
  );
  
  return filtered.length > 0 ? filtered : MOCK_DOCTORS.slice(0, 3);
}

export async function bookAppointment(appointment: Appointment): Promise<{ success: boolean; message: string }> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  // Simulate random failure (10% chance)
  if (Math.random() < 0.1) {
    throw new Error("The booking server is currently overloaded. Please try again.");
  }
  
  return {
    success: true,
    message: `Appointment successfully booked with ${MOCK_DOCTORS.find(d => d.id === appointment.doctorId)?.name} for ${appointment.date} at ${appointment.time}.`
  };
}
