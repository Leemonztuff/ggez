import {
  createInteractionSystemDefinition,
  createPickupSystemDefinition,
  createSequenceSystemDefinition,
  createTriggerSystemDefinition
} from "@ggez/gameplay-runtime";
import type { GameplayRuntimeSystemDefinition } from "@ggez/gameplay-runtime";

export function createSouldollsSystems(): GameplayRuntimeSystemDefinition[] {
  return [
    createTriggerSystemDefinition(),
    createInteractionSystemDefinition(),
    createPickupSystemDefinition(),
    createSequenceSystemDefinition()
  ];
}
