import { phaseForHour, WEATHERS, type DayPhase, type Weather } from "./zones";

const SECONDS_PER_GAME_HOUR = 60;

export class WorldClock {
  private hour = 9.7;

  advance(deltaSeconds: number) {
    this.hour = (this.hour + deltaSeconds / SECONDS_PER_GAME_HOUR) % 24;
  }

  get phase(): DayPhase {
    return phaseForHour(this.hour);
  }

  get timeLabel(): string {
    const hours = Math.floor(this.hour);
    const minutes = Math.floor((this.hour - hours) * 60);
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }

  get isNight(): boolean {
    return this.phase === "noche";
  }
}

export class WeatherCycle {
  private remaining = 45;
  private current: Weather = "soleado";

  advance(deltaSeconds: number, rng: () => number = Math.random) {
    this.remaining -= deltaSeconds;

    if (this.remaining <= 0) {
      this.remaining = 40 + rng() * 60;
      const opciones = WEATHERS.filter((weather) => weather !== this.current);
      this.current = opciones[Math.floor(rng() * opciones.length)] ?? "soleado";
    }
  }

  get weather(): Weather {
    return this.current;
  }

  set weather(weather: Weather) {
    this.current = weather;
  }
}
