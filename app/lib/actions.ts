'use server';

import { z } from 'zod';
import { sql } from '@vercel/postgres';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

const FormSchema = z.object({
  id: z.string(),
  customerId: z.string({
    invalid_type_error: 'Please select a customer',
  }),
  amount: z.coerce
    .number()
    .gt(0, { message: 'Please enter an amount greater than $0.' }),
  status: z.enum(['paid', 'pending'], {
    invalid_type_error: 'Please select an invoice status',
  }),
  date: z.string(),
});

const CreateInvoice = FormSchema.omit({ id: true, date: true });

export type State = {
  errors?: {
    customerId?: string[];
    amount?: string[];
    status?: string[];
  };
  message?: string | null;
};

export async function createInvoice(prevState: State, formData: FormData) {
  // Validate form using zod
  const validatedFields = CreateInvoice.safeParse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  });

  // If form validation is not usccessful, return errors early on. Else, continue
  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten(),
      message: 'Missing Fields. Failed to Create Invoice.',
    };
  }

  // Getting data ready for database
  const { customerId, amount, status } = validatedFields.data;
  const amountInCents = amount * 100;
  const date = new Date().toISOString().split('T')[0];

  try {
    // Send data to database
    await sql`
      INSERT INTO invoices (customer_id, amount, status, date)
      VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
    `;
  } catch (e) {
    // Return error if database fails
    return {
      message: 'Database Erorr: Failed to create invoice',
    };
  }
  console.log('Changed invoice');
  // Revalidate the path to update the cache
  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');
}

const UpdateInvoice = FormSchema.omit({ id: true, date: true });

export default async function updateInvoice(
  id: string, 
  prevState: State, 
  formData: FormData
) {
  const validatedFields = UpdateInvoice.safeParse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten(),
      message: 'Missing Fields. Failed to Update Invoice.',
    };
  }

  const { customerId, amount, status } = validatedFields.data;

  try {
    await sql`
      UPDATE invoices
      SET customer_id = ${customerId}, amount = ${amount}, status = ${status}
      WHERE id = ${id}
    `;
  } catch (e) {
    return {
      message: 'Failed to update invoice',
    };
  }
}

export async function deleteInvoice(id: string) {
  try {
    await sql`
      DELETE FROM invoices
      WHERE id = ${id}
    `;
  } catch (e) {
    return {
      message: 'Failed to delete invoice',
    };
  }

  revalidatePath('/dashboard/invoices');
}
