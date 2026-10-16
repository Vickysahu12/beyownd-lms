// src/types/express.d.ts
// Express ke Request type mein `user` add karta hai - protect middleware
// isse set karta hai, aur har controller bina cast kiye req.user padh sakta hai.

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; role: string };
    }
  }
}

export {};
