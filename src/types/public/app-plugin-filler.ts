import { App } from 'obsidian';
import { TerritoryServiceInterface } from './carnival-service-types';

export interface ObsidianAppWithPlugins extends App {
	plugins?: {
		plugins?: {
			'carnival-records'?: {
				carnivalNetwork?: {
					CarnivalRegistryService?: TerritoryServiceInterface;
				};
			};
		};
	};
}