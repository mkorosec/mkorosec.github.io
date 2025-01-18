function makeDraggable(modalElement) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

    const dragMouseDown = (e) => {
    pos3 = e.clientX;
    pos4 = e.clientY;

    document.onmouseup = closeDragElement;
    document.onmousemove = elementDrag;
    }

    const elementDrag = (e) => {
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;

    modalElement.style.top = (modalElement.offsetTop - pos2) + "px";
    modalElement.style.left = (modalElement.offsetLeft - pos1) + "px";
    }

    const closeDragElement = () => {
    document.onmouseup = null;
    document.onmousemove = null;
    }

    if (modalElement.querySelector('.modal-header')) {
    modalElement.querySelector('.modal-header').onmousedown = dragMouseDown;
    } else {
    modalElement.onmousedown = dragMouseDown;
    }
}

makeDraggable(document.getElementById('floatingDialog'));