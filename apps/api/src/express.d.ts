declare global {
  namespace Express {
    interface Request {
      correlationId: string;
      accessUser?: {
        id: string;
        name: string;
        email: string;
        role: string;
      };
    }
  }
}

export {};
