import { getRequestIP } from '@tanstack/react-start/server';
import { handleRequest } from './request';

const crew = ({ request }: { request: Request }) => handleRequest(request, getRequestIP());

export const crewHandlers = { GET: crew, HEAD: crew, POST: crew, PUT: crew, PATCH: crew, DELETE: crew, OPTIONS: crew };
