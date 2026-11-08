const fs = require('fs');
const path = require('path');
const routesFilePath = path.join(__dirname, '../../data/routes.json');
//funcion para leer el archivo json y devuelve el array de rutas 
const getRoutes = () =>{
    try {
        //leemos el archivo de forma sincronica
        const fileData = fs.readFileSync(routesFilePath, 'utf-8');
        //se convierte  el texto plano en un obejto de js 
        return JSON.parse(fileData);
    } catch (error) {
        console.error("Error al leer el archivo JSON", error)
        //en caso de un error devolvemos el array vacio
        return [];
    }   
};
const saveRoutes = (routesArray) => {
    try {
        //convertimos el array de js a texto en json 
        const jsonData = JSON.stringify(routesArray, null, 2);

        //Escribiremos el texcto de archivo de forma sincronnica
        fs.writeFileSync(routesFilePath, jsonData, 'utf-8');
        //retornamos true si todo está corecto
        return true;
    } catch (error) {
        console.error("Error al guardar el archivo  JSON", error)
        return false;
    }
}


// Estados posibles de una ruta. Las rutas antiguas no tienen "status" y se consideran activas.
const ROUTE_STATUS = {
    ACTIVE: 'activa',
    CANCELLED: 'cancelada'
};

const isRouteCancelled = (route) => route?.status === ROUTE_STATUS.CANCELLED;

const isRouteExpired = (route, now = Date.now()) => {
    const expiresAtTimestamp = Number(route?.expiresAtTimestamp);
    return Number.isFinite(expiresAtTimestamp) && expiresAtTimestamp > 0 && expiresAtTimestamp <= now;
};

/**
 * Ruta visible para los pasajeros: no cancelada, no vencida y con asientos.
 */
const isRouteActive = (route, now = Date.now()) => {
    const seats = Number(route?.seats);
    return !isRouteCancelled(route) && !isRouteExpired(route, now) && Number.isInteger(seats) && seats > 0;
};

//exportamos el archiov para que el controlador pueda utriliazarlo
module.exports = {
    getRoutes,
    saveRoutes,
    ROUTE_STATUS,
    isRouteCancelled,
    isRouteExpired,
    isRouteActive
}