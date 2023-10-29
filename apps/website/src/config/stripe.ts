import { STRIPE_API_KEY } from './envs';

export const PLANS = [
  {
    name: 'Free',
    slug: 'free',
    quota: 10,
    pagesPerPdf: 5,
    price: {
      amount: 0,
      priceId: {
        test: '',
        production: '',
      },
    },
  },
  {
    name: 'Pro',
    slug: 'pro',
    quota: 50,
    pagesPerPdf: 25,
    price: {
      amount: 999,
      priceId: {
        test: STRIPE_API_KEY,
        production: '',
      },
    },
  },
];
