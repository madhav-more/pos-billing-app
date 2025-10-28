import {AppRegistry} from 'react-native';
import 'react-native-url-polyfill/auto';
import App from './App';
import {name as appName} from './package.json';

AppRegistry.registerComponent(appName, () => App);
