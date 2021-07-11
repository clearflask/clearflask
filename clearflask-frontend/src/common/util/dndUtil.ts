import { FluidDragActions, PreDragActions, SensorAPI } from "react-beautiful-dnd";
import windowIso from "../windowIso";

export const dndDrag = async (api: SensorAPI, draggableId: string, droppableId: string): Promise<boolean> => {
  if (windowIso.isSsr) return false;

  var preDrag: PreDragActions | null | undefined;
  var drag: FluidDragActions | undefined;
  try {
    preDrag = api.tryGetLock(draggableId);
    if (!preDrag) return false;

    const draggableEl = dndFindElement('draggable', draggableId);
    const droppableEl = dndFindElement('droppable', droppableId);
    if (!draggableEl || !droppableEl) {
      preDrag.abort();
      return false;
    }

    const draggablePosition = draggableEl.getBoundingClientRect();
    const droppablePosition = droppableEl.getBoundingClientRect();

    const from = {
      x: draggablePosition.x + draggablePosition.width / 2,
      y: draggablePosition.y + draggablePosition.height / 2,
    }
    const to = {
      x: droppablePosition.x + droppablePosition.width / 2,
      y: droppablePosition.y + droppablePosition.height / 2,
    }

    drag = preDrag.fluidLift(from);
    var step = 0.0;
    while (step <= 1) {
      step += 0.05;

      await new Promise(resolve => setTimeout(resolve, 5));
      if (!drag.isActive()) {
        drag.cancel();
        return false;
      }

      drag.move({
        x: from.x + (to.x - from.x) * step,
        y: from.y + (to.y - from.y) * step,
      });
    }

    drag.move({
      x: droppablePosition.x + droppablePosition.width / 2 - (draggablePosition.x + draggablePosition.width / 2),
      y: droppablePosition.y + droppablePosition.height / 2 - (draggablePosition.y + draggablePosition.height / 2),
    });

    drag.drop();

    return true;

  } catch (e) {
    if (drag?.isActive()) drag.cancel();
    if (preDrag?.isActive()) preDrag.abort();

    return false;
  }
}

export const dndFindElement = (type: 'droppable' | 'draggable', id: string): Element | null => {
  if (windowIso.isSsr) return null;
  return windowIso.document.querySelector(`[data-rbd-${type}-id="${id.replace(/["\\]/g, '\\$&')}"]`);
}
