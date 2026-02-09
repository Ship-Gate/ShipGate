/**
 * Test fixtures for try-catch-toast-success pattern (React)
 */

import { toast } from 'react-hot-toast';

// Pattern 1: try/catch with toast.success in catch
export const fixture1 = `
async function handleSubmit() {
  try {
    await api.submit(data);
  } catch (error) {
    toast.success('Data saved successfully!');
  }
}
`;

// Pattern 2: Multiple async operations, catch shows success
export const fixture2 = `
async function uploadAndProcess() {
  try {
    const file = await uploadFile();
    await processFile(file);
  } catch (err) {
    toast.success('Upload completed!');
  }
}
`;

// Pattern 3: Using react-toastify
export const fixture3 = `
import { toast } from 'react-toastify';

async function saveSettings() {
  try {
    await updateSettings(settings);
  } catch (error) {
    toast.success('Settings saved!');
  }
}
`;

// Pattern 4: Using sonner
export const fixture4 = `
import { toast } from 'sonner';

async function createUser() {
  try {
    await createUserAPI(userData);
  } catch (e) {
    toast.success('User created successfully');
  }
}
`;

// Valid: Catch shows error toast
export const validFixture1 = `
async function handleSubmit() {
  try {
    await api.submit(data);
  } catch (error) {
    toast.error('Failed to submit: ' + error.message);
  }
}
`;

// Valid: Catch logs error and shows error toast
export const validFixture2 = `
async function handleSubmit() {
  try {
    await api.submit(data);
    toast.success('Data saved successfully!');
  } catch (error) {
    console.error(error);
    toast.error('Failed to save data');
  }
}
`;
