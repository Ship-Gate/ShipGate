import React from 'react';
import { AccountList } from './AccountList';
import { AccountDetail } from './AccountDetail';
import { AccountForm } from './AccountForm';
import { TransferFundsForm } from './TransferFundsForm';

export function App() {
  return (
    <div>
      <h1>Payments</h1>
      <section>
        <h2>Accounts</h2>
        <AccountList items={[]} />
      </section>
    </div>
  );
}