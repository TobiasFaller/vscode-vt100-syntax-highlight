type PromiseType<T extends (...args: any[]) => Promise<any>>
	= T extends ((...args: any[]) => Promise<infer R>) ? R : any;

export const debounce = <F extends (...args: any[]) => Promise<any>>(func: F, waitFor: number) => {
	let timeout: NodeJS.Timeout;

	return (...args: Parameters<F>): Promise<PromiseType<F>> =>
		new Promise((resolve) => {
			if (timeout) {
				clearTimeout(timeout);
			}

			timeout = setTimeout(async () => resolve(await func(...args)), waitFor);
		});
};
