import { createContext, ReactNode, useContext, useState } from 'react';

const CHAVE = 'aerogest.exercicio';
const Ctx = createContext<{ exercicio: number; setExercicio: (n: number) => void }>({ exercicio: new Date().getFullYear(), setExercicio: () => undefined });

/** Exercício selecionado — preferência de interface (não é dado sensível). */
export function ExercicioProvider({ children }: { children: ReactNode }) {
  const [exercicio, set] = useState<number>(() => {
    try {
      const v = Number(localStorage.getItem(CHAVE));
      return v >= 2000 && v <= 2100 ? v : new Date().getFullYear();
    } catch {
      return new Date().getFullYear();
    }
  });
  const setExercicio = (n: number) => {
    set(n);
    try {
      localStorage.setItem(CHAVE, String(n));
    } catch {
      /* armazenamento indisponível */
    }
  };
  return <Ctx.Provider value={{ exercicio, setExercicio }}>{children}</Ctx.Provider>;
}

export const useExercicio = () => useContext(Ctx);
