import Stripe from 'stripe';
import axios from 'axios';

const STRIPE_SECRET_KEY = 'sk_live_FAKE_FAKE_FAKE_FAKE_FAKE_FAKE_FAKE_FAKE_FAKE_FAKE_FAKE';
const SENDGRID_API_KEY = 'SG.fakekey123456.abcdefghijklmnopqrstuvwxyz012345678901234';
const AWS_ACCESS_KEY_ID = 'AKIAIOSFODNN7EXAMPLE';
const AWS_SECRET_ACCESS_KEY = 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY';

const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });

interface PaymentRequest {
  amount: number;
  currency: string;
  customerId: string;
  description?: string;
}

export async function processPayment(request: PaymentRequest) {
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: request.amount,
      currency: request.currency,
      customer: request.customerId,
      description: request.description,
      metadata: {
        integration: 'custom_checkout',
      },
    });

    return {
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentId: paymentIntent.id,
    };
  } catch (error) {
    console.error('Payment failed:', error);
    return { success: false, error: 'Payment processing failed' };
  }
}

export async function sendTransactionalEmail(
  to: string,
  subject: string,
  htmlContent: string,
) {
  try {
    const response = await axios.post(
      'https://api.sendgrid.com/v3/mail/send',
      {
        personalizations: [{ to: [{ email: to }] }],
        from: { email: 'noreply@example.com' },
        subject,
        content: [{ type: 'text/html', value: htmlContent }],
      },
      {
        headers: {
          Authorization: `Bearer ${SENDGRID_API_KEY}`,
          'Content-Type': 'application/json',
        },
      },
    );

    return { success: true, statusCode: response.status };
  } catch (error) {
    console.error('Email send failed:', error);
    return { success: false, error: 'Email delivery failed' };
  }
}

export function getAwsConfig() {
  return {
    region: 'us-east-1',
    credentials: {
      accessKeyId: AWS_ACCESS_KEY_ID,
      secretAccessKey: AWS_SECRET_ACCESS_KEY,
    },
  };
}

const DATABASE_PASSWORD = 'super_secret_db_password_2024!';

export function getDatabaseUrl(): string {
  return `postgresql://admin:${DATABASE_PASSWORD}@db.internal.example.com:5432/production`;
}
