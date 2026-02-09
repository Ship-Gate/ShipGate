/**
 * Test fixtures for promise-catch-default-success pattern
 */

// Pattern 1: .catch(() => true)
export const fixture1 = `
function saveData() {
  return api.save(data)
    .catch(() => true);
}
`;

// Pattern 2: .catch(() => ({ success: true }))
export const fixture2 = `
function processPayment() {
  return chargeCard()
    .then(process)
    .catch(() => ({ success: true }));
}
`;

// Pattern 3: .catch(() => toast.success())
export const fixture3 = `
import { toast } from 'react-hot-toast';

function uploadFile() {
  return upload(file)
    .catch(() => toast.success('Upload successful!'));
}
`;

// Pattern 4: .catch(() => 'success')
export const fixture4 = `
function submitForm() {
  return submit(data)
    .catch(() => 'success');
}
`;

// Pattern 5: Arrow function returning success
export const fixture5 = `
function handleAction() {
  return performAction()
    .catch(error => ({ ok: true }));
}
`;

// Valid: Catch handles error properly
export const validFixture1 = `
function saveData() {
  return api.save(data)
    .catch(error => {
      console.error(error);
      return { success: false, error: error.message };
    });
}
`;

// Valid: Catch shows error notification
export const validFixture2 = `
import { toast } from 'react-hot-toast';

function uploadFile() {
  return upload(file)
    .catch(error => toast.error('Upload failed: ' + error.message));
}
`;
