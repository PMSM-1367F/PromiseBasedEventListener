const btn1 = document.querySelector('#btn1');
const btn2 = document.querySelector('#btn2');
const btn3 = document.querySelector('#btn3');

EventSignal.addEventListenerTo(btn1, 'click')
    .receive(data => {
        alert('first message!');
        return EventSignal.addEventListenerTo(btn2, 'click');
    })
    .receive(data => {
        alert('second message!');
        return EventSignal.addEventListenerTo(btn3, 'click');
    })
    .receive(data => alert('third message!'));

new Signal(raise => {
    const ID = setInterval(() => raise(ID), 1000);
})
    .receive(data => {
        console.log(data, 'setInterval');
        setTimeout(() => clearInterval(data), 10000);
    });
