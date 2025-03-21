import './Canvas.css';
import Modal from '../Modal/Modal';
import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { createCanvas, pushToUndo, setUserName, setSessionId, setUserId, setSocket, saveBackupCanvas } from '../../actions';
import FetcRequest from '../../services/FetcRequest';
import { toolsFactory } from '../../services/toolsFactory';
import { WebSocketTransmitter } from '../../services/websocket/WebSocketTransmitter';
import { WebSocketReceiver } from '../../services/websocket/webSocketReceiver';
import { useSnackbar } from 'notistack';

const SURL = process.env.NODE_ENV === 'production' ? 'http://62.113.107.21:8080/' : 'http://localhost:5000/';
const WSURL = process.env.NODE_ENV === 'production' ? 'ws://62.113.107.21:8080/' : 'ws://localhost:5000/';

const Canvas = () => {

    const req = new FetcRequest();
    const [ open, setOpen ] = useState(true);
    const canvasRef = useRef();
    const usernameRef = useRef();
    const dispatch = useDispatch();
    const { tool, color, width, userId, canvas, sessionId, socket } = useSelector(state=>state);
    const { enqueueSnackbar } = useSnackbar();

    useEffect( () => {
        dispatch( createCanvas(canvasRef.current) );
         // eslint-disable-next-line
    },[] );

    useEffect( () => {
        if(userId) canvasHandler(canvas);
         // eslint-disable-next-line
    },[userId, tool, color, width] );
    
    useEffect( () => {
        if(sessionId) getCanvasState();
         // eslint-disable-next-line
    },[sessionId] );


const canvasUpdate = (response) => {
    const ctx = canvasRef.current.getContext('2d');
    const img = document.createElement('img');
    img.src = response.data;
    img.onload = () => {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height); 
        ctx.drawImage(img, 0, 0, canvasRef.current.width, canvasRef.current.height);
    }
}

const getCanvasState = () => {
    req.request( `${SURL}image?id=${sessionId}` ) 
    .then( canvasUpdate )
    .catch(e =>  console.log(e));
}

const canvasHandler = (canvas) => {
    const ctx = canvas.getContext('2d');
    let mouseDown = false;
    canvas.onmousemove = mouseMoveHandler;
    canvas.onmousedown = mouseDownHandler;
    canvas.onmouseup = mouseUpHandler;
    let startX;
    let startY;
    let currentX;
    let currentY;
    let saved;

    function mouseDownHandler(e) {
        mouseDown = true;
        saved = canvas.toDataURL();
        ctx.beginPath();
        startX = e.pageX - e.target.offsetLeft;
        startY = e.pageY - e.target.offsetTop;
        dispatch(pushToUndo( canvasRef.current.toDataURL() ));
    }

    function mouseUpHandler(e) {
        mouseDown = false;
        ctx.beginPath();
        const params = {
                method: 'DRAW',
                tool: tool,
                    figure: {
                        type: 'FINISH',
                    }
        }

        WebSocketTransmitter.transmit(socket, {...params,  userId, sessionId} );
        const payload = JSON.stringify({'img': canvasRef.current.toDataURL()});
        dispatch( saveBackupCanvas(req.request, `${SURL}image?id=${sessionId}`, payload)  );
    }

    function mouseMoveHandler(e) {
        if(mouseDown){
            currentX = e.pageX - e.target.offsetLeft;
            currentY = e.pageY - e.target.offsetTop;
            const params =  {
                    method: 'DRAW',
                    tool: tool,
                    saved: saved,
                        figure: {
                            type: 'DRAING',
                            startX: startX,
                            startY: startY,
                            currentX: currentX,
                            currentY: currentY,
                            color: color,
                            width: width,
                        }
            }
            toolsFactory.init(params, canvas);
            WebSocketTransmitter.transmit(socket, {...params,  userId, sessionId} );
        }
    }
}

    const userAuthorization = (userName) => {
            const data = {
                sessionId: window.location.pathname.replace('/', ''),
                userId: `u${Date.now().toString(8)}`,
                userName,
            }
            dispatch(setUserName(userName));
            dispatch(setSessionId(data.sessionId));
            dispatch(setUserId(data.userId));
            webSocketConnect(data);
    }

    const authorizationHandler = (userName) => {
        if( userName.trim() !== '' && userName.length > 3 ) {
            setOpen(false);
            userAuthorization(userName);
        }
    }

    const drawHandler = (msg) => {
        WebSocketReceiver.recive(msg, canvas);
    }

    const webSocketConnect = (data) => {
        const socket = new WebSocket(WSURL); 
        socket.onopen = () => {
            socket.send(JSON.stringify({...data, method: 'CONNECTION'}));
        } 
        socket.onmessage = (e) => {
            let msg = JSON.parse(e.data);
            switch(msg.method) {
                case 'CONNECTION' :
                enqueueSnackbar(`Пользователь ${msg.userName} подключился`, {variant : 'info', anchorOrigin: { horizontal: 'right', vertical: 'top' }});
                    break;
                case 'DRAW' :
                    drawHandler(msg);
                break;
                default: return msg;
            }
        }

        dispatch(setSocket(socket));  
    }

    return (
        <>
            <canvas ref={canvasRef} width={700} height={500} className='canvas'><p>Ваш браузер не поддерживает рисование</p></canvas>

            <Modal open={open} setOpen={setOpen}>
                <h4 className='modal-title'>Приветствую Вас на платформе "ОНЛАЙН РИСОВАНИЕ"</h4>
                <span>Чтобы продолжить, Вам нужно представиться:</span>
                <div className="wrap-input">
                    <input className='modal-input' ref={usernameRef} type="text" placeholder="Введите ваше имя" />
                    <button className='modal-button' onClick={e=> authorizationHandler(usernameRef.current.value)}  type="button">Войти</button>
                </div>
                <span style={{'color':'#515852', 'fontSize':'12px', 'marginTop':'10px', 'display':'block'}}>
                    Введите свое имя, войдите в интерфейс, нажмите на кнопку пригласить друга, отправьте ему ссылку и рисуйте вместе!
                </span>
            </Modal>
        </>
    )

}

export default Canvas;