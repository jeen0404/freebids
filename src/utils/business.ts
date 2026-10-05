export const BUSINESS = {
  name: 'KRUX',
  udyam: 'UDYAM-KR-03-0767064',
  address: 'No. 402, HK Narayan Swami Building, Hagadur Main Road, Immadihalli, Bengaluru, Karnataka 560066, India',
  city: 'Bengaluru, Karnataka, India',
  email: (import.meta.env.VITE_CONTACT_EMAIL as string | undefined) || 'hello@freebids.lol',
} as const;
