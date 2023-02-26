import Moveable from 'moveable';
import type { ICodeSpeedPerYear } from '../merger';

const legend = document.createElement('canvas');
legend.id = 'legendID';
const styleLegend = legend.style;
styleLegend.font = '14px/32px Arial, Halvetica, sans-serif';
styleLegend.zIndex = '1000';
styleLegend.position = 'absolute';
styleLegend.bottom = '3%';
styleLegend.right = '2%';
legend.width = 50;
legend.height = 30;
document.body.append(legend);

export function addLegend(codeSpeedPerYear: ICodeSpeedPerYear): void {
	const alpha = codeSpeedPerYear['Road'].alpha;

	resetDimensions(alpha, legend);

	//const color = '#' + (0x1000000 + Math.random() * 0xffffff).toString(16).substr(1, 6);
	const drawer = Drawer(alpha);
	const move = createMoveable();
	move.updateRect();
	drawer(-(Math.tan(alpha) / 2), '#0000FF');

	// display the slope and speed of each means of transport existing for a given year ( Configuration.year)
	const alphaDeg = Math.round(((alpha * 180) / Math.PI) * 10) / 10;
	let title = 'Slope (α) : ' + alphaDeg + '° \n';
	title += 'Between cones : ' + Math.round(2 * (90 - alphaDeg) * 10) / 10 + '° \n';
	title += 'Fastest speed = ' + Math.round((1 / Math.cos(alpha)) * 100) / 100 + ' x road speed\n';
	for (const el in codeSpeedPerYear) {
		title += el + ' : ' + codeSpeedPerYear[el].speed + ' Kph ' + '\n';
	}

	document.getElementById('legendID').title = title;
}

function setupCanvas() {
	// Get the device pixel ratio, falling back to 1.
	const dpr = window.devicePixelRatio || 1;
	// Get the size of the canvas in CSS pixels.
	const rect = legend.getBoundingClientRect();
	// Give the canvas pixel dimensions of their CSS
	// size * the device pixel ratio.
	legend.width = rect.width * dpr;
	legend.height = rect.height * dpr;
	const ctx = legend.getContext('2d');
	// Scale all drawing operations by the dpr, so you
	// don't have to worry about the difference.
	ctx.scale(dpr, dpr);
	return ctx;
}

function Drawer(alpha: number) {
	//canvas.height = (7.5 * canvas.width) / devicePixelRatio;
	legend.height = (Math.tan(alpha) * (legend.width / 2)) / devicePixelRatio;
	const ctx = setupCanvas();
	ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
	const A = 1; // A=1 c'est une valeur comme une autre qui a peu d'importance pour la suite car tout est proportionel!
	const xmin = -A / 2;
	const xmax = A / 2;
	const ymax = 0;
	return function (ymin = null, color = '#0000FF') {
		const Height = legend.height;
		const Width = legend.width;
		ymin = ymin === null ? (Height / Width) * 20 : ymin;
		function toCnv(x: number, y: number): [number, number] {
			return [(Width * (x - xmin)) / (xmax - xmin), (Height * (ymax - y)) / (ymax - ymin)];
		}
		const H = Math.tan(alpha) * xmax;
		ctx.beginPath();
		ctx.moveTo(...toCnv(xmin, 0)); // point en haut à gauche
		ctx.lineTo(...toCnv(xmax, 0)); // point en haut droite
		ctx.lineTo(...toCnv(0, -H)); //point bas milieu
		ctx.closePath();
		ctx.strokeStyle = color;
		ctx.lineWidth = 2;
		ctx.stroke();
	};
}

function createMoveable() {
	// remove any previous moveable
	const divs = document.querySelectorAll('.moveable1');
	Array.from(divs).forEach((div) => div.remove());
	// create new moveable
	const move = new Moveable(document.body, {
		target: legend,
		className: 'moveable1',
		origin: false,
		draggable: true,
		scalable: true,
		resizable: true,
		keepRatio: true,
		rotatable: true,
	});
	move.on('drag', ({ target, transform }) => {
		target.style.transform = transform;
		move.updateRect();
	});
	move.on('resize', ({ target, width, height }) => {
		target.style.width = width + 'px';
		target.style.height = height + 'px';
		move.updateRect();
	});
	move.on('rotate', ({ target, transform }) => {
		target.style.transform = transform;
		move.updateRect();
	});
	return move;
}

function resetDimensions(alpha: number, canvas: HTMLCanvasElement) {
	canvas.width = 50;
	canvas.height = Math.tan(alpha) * (canvas.width / 2);
	canvas.style.width = canvas.width + 'px';
	canvas.style.height = canvas.height + 'px';
}
