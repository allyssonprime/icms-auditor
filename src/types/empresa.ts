import type { Timestamp } from 'firebase/firestore';

export interface EmpresaFirestore {
  taxId: string;
  alias?: string;
  founded?: string;
  head?: boolean;

  company?: {
    id?: number;
    name?: string;
    equity?: number;
    nature?: { id: number; text: string };
    size?: { id: number; acronym: string; text: string };
    simples?: { optant: boolean; since: string | null };
    simei?: { optant: boolean; since: string | null };
    members?: Array<{
      since?: string;
      person?: {
        id?: string;
        type?: string;
        name?: string;
        taxId?: string;
        age?: string;
      };
      role?: { id: number; text: string };
      agent?: {
        person?: {
          id?: string;
          type?: string;
          name?: string;
          taxId?: string;
          age?: string;
        };
        role?: { id: number; text: string };
      };
    }>;
  };

  status?: { id: number; text: string };
  statusDate?: string;

  address?: {
    municipality?: number;
    street?: string;
    number?: string;
    district?: string;
    city?: string;
    state?: string;
    details?: string | null;
    zip?: string;
    country?: { id: number; name: string };
  };

  mainActivity?: { id: number; text: string };
  sideActivities?: Array<{ id: number; text: string }>;

  phones?: Array<{ type?: string; area?: string; number?: string }>;
  emails?: Array<{ ownership?: string; address?: string; domain?: string }>;

  suframa?: unknown[];

  consultadoEm?: Timestamp;
}
