/* ---------- démarrage ---------- */
function stopAudio(){stopDrone();stopMetro();stopMic()}
/* Changer d'appli (partition sur la même tablette) ne coupe ni le bourdon ni le métronome. */
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&TM&&TM.run)takeWake()});



init();
