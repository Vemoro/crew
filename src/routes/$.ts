import { createFileRoute } from '@tanstack/react-router';
import { crewHandlers } from '../server/route-handlers';

export const Route = createFileRoute('/$')({ server: { handlers: crewHandlers } });
