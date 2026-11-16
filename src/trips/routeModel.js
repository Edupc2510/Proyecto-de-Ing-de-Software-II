const fs = require('fs');
const path = require('path');
const routesFilePath = path.join(process.env.MOVESHARE_DATA_DIR || path.join(__dirname, '../../data'), 'routes.json');
//funcion para leer el archivo json y devuelve el array de rutas 
const getRoutes = () =>{
    try {
        //leemos el archivo de forma sincronica
        if (!fs.existsSync(routesFilePath)) return [];
        const fileData = fs.readFileSync(routesFilePath, 'utf-8');
        //se convierte  el texto plano en un obejto de js 
        return JSON.parse(fileData);
    } catch (error) {
        console.error("Error al leer el archivo JSON", error)
        //en caso de un error devolvemos el array vacio
        throw error;
    }   
};
const saveRoutes = (routesArray) => {
    try {
        //convertimos el array de js a texto en json 
        const jsonData = JSON.stringify(routesArray, null, 2);

        //Escribiremos el texcto de archivo de forma sincronnica
        fs.mkdirSync(path.dirname(routesFilePath), { recursive: true });
        fs.writeFileSync(routesFilePath, jsonData, 'utf-8');
        //retornamos true si todo está corecto
        return true;
    } catch (error) {
        console.error("Error al guardar el archivo  JSON", error)
        return false;
    }
}


//exportamos el archiov para que el controlador pueda utriliazarlo
const ROUTE_STATUS = { ACTIVE: 'activa', CANCELLED: 'cancelada' };
const isRouteCancelled = route => route?.status === ROUTE_STATUS.CANCELLED;
const isRouteExpired = (route, now = Date.now()) => {
    const departure = Number(route?.expiresAtTimestamp);
    return Number.isFinite(departure) && departure > 0 && departure <= now;
};
const isRouteActive = (route, now = Date.now()) => !isRouteCancelled(route) &&
    !isRouteExpired(route, now) && Number.isInteger(Number(route?.seats)) && Number(route.seats) > 0;
module.exports = {
    ROUTE_STATUS, isRouteCancelled, isRouteExpired, isRouteActive,
    getRoutes,
    saveRoutes
}
