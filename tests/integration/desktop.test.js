import chai from 'chai';
import dirty from 'dirty-chai';
import sinonChai from 'sinon-chai';
chai.use(sinonChai);
chai.use(dirty);
import sinon from 'sinon';
const { describe, it } = global;
const { expect } = chai;
import { createTestInstance } from '../helpers/meteorDesktop';
import fs from 'fs';
import path from 'path';
import shell from 'shelljs';
import paths from '../helpers/paths';

function getModuleJson(module) {
    const moduleJsonPath = path.join(
        paths.fixtures.testProjectInstall, '.desktop', 'modules', module, 'module.json'
    );
    return JSON.parse(fs.readFileSync(moduleJsonPath, 'UTF-8'));
}

function saveModuleJson(module, moduleJson) {
    const moduleJsonPath = path.join(
        paths.fixtures.testProjectInstall, '.desktop', 'modules', module, 'module.json'
    );
    fs.writeFileSync(
        moduleJsonPath, JSON.stringify(moduleJson, null, 2)
    );
}

describe('desktop', () => {
    let MeteorDesktop;

    function stubLog(object, methods, stubProcessExit) {
        const stubs = {};

        if (stubProcessExit) {
            sinon.stub(process, 'exit');
        }

        methods.forEach(method => {
            stubs[method] = sinon.stub(object.log, method);
        });

        this.restore = () => {
            Object.keys(stubs).forEach(method => stubs[method].restore());
            if (stubProcessExit) {
                process.exit.restore();
            }
        };

        this.stubs = stubs;

        return this;
    }

    beforeEach(() => {
        MeteorDesktop = createTestInstance();
    });

    describe('#init', () => {
        it('should create .desktop scaffold', () => {
            const logStub = stubLog(MeteorDesktop.desktop, ['info']);
            MeteorDesktop.init();
            expect(fs.existsSync(MeteorDesktop.env.paths.desktop.root)).to.be.true();
            expect(fs.existsSync(MeteorDesktop.env.paths.desktop.settings)).to.be.true();
            expect(fs.existsSync(MeteorDesktop.env.paths.desktop.desktop)).to.be.true();
            expect(fs.existsSync(MeteorDesktop.env.paths.desktop.assets)).to.be.true();
            expect(fs.existsSync(MeteorDesktop.env.paths.desktop.splashScreen)).to.be.true();
            logStub.restore();
        });

        it('should warn about .desktop that already exists', () => {
            shell.mkdir(MeteorDesktop.env.paths.desktop.root);
            const logStub = stubLog(MeteorDesktop.desktop, ['info', 'warn']);
            MeteorDesktop.init();
            expect(logStub.stubs.warn).to.have.been.calledOnce();
            logStub.restore();
        });
    });

    describe('#getDependencies', () => {
        it('should get all dependencies from .desktop', () => {
            shell.cp('-rf', paths.fixtures.desktop, paths.fixtures.testProjectInstall);
            const deps = MeteorDesktop.desktop.getDependencies();
            expect(deps).to.have.a.deep.property('fromSettings.some-package', '1.2.3');
            expect(deps).to.have.a.deep.property('plugins.meteor-desktop-splash-screen', '0.0.2');
            expect(deps).to.have.a.deep.property('modules.someModule.dependency', '1.0.1');
            expect(deps).to.have.a.deep.property('modules.someModule2.dependency2', '0.0.5');
        });
    });

    describe('#getSettings', () => {
        it('should read settings.json', () => {
            shell.cp('-rf', paths.fixtures.desktop, paths.fixtures.testProjectInstall);
            const settings = MeteorDesktop.desktop.getSettings();
            expect(settings).to.have.a.property('window');
            expect(settings).to.have.a.property('packageJsonFields');
        });

        it('should report error on missing file', () => {
            const logStub = stubLog(MeteorDesktop.desktop, ['error']);
            sinon.stub(process, 'exit');
            MeteorDesktop.desktop.getSettings();
            expect(logStub.stubs.error).to.have.been.calledOnce();
            logStub.restore();
            process.exit.restore();
        });
    });

    describe('#getDependencies', () => {
        it('should create a dependency list', () => {
            shell.cp('-rf', paths.fixtures.desktop, paths.fixtures.testProjectInstall);
            const deps = MeteorDesktop.desktop.getDependencies();
            expect(deps).to.deep.equal({
                fromSettings: { 'some-package': '1.2.3' },
                plugins: { 'meteor-desktop-splash-screen': '0.0.2' },
                modules: {
                    someModule: { dependency: '1.0.1' },
                    someModule2: { dependency2: '0.0.5' }
                }
            });
        });

        it('report error on duplicated module name', () => {
            shell.cp('-rf', paths.fixtures.desktop, paths.fixtures.testProjectInstall);
            const moduleJson = getModuleJson('someModule');
            moduleJson.name = 'someModule2';
            saveModuleJson('someModule', moduleJson);
            const logStub = stubLog(MeteorDesktop.desktop, ['error'], true);
            MeteorDesktop.desktop.getDependencies();
            expect(logStub.stubs.error).to.have.been.calledWithMatch(
                sinon.match(/already registered/)
            );
            logStub.restore();
        });
    });
    describe('#getModuleConfig', () => {
        it('should report error on missing module.json', () => {
            const logStub = stubLog(MeteorDesktop.desktop, ['error'], true);
            MeteorDesktop.desktop.getModuleConfig('nonExistingModule');
            expect(logStub.stubs.error).to.have.been.calledWithMatch(
                sinon.match(/error while trying to read/)
            );
            logStub.restore();
        });

        it('should report error on missing name field in module.json', () => {
            shell.cp('-rf', paths.fixtures.desktop, paths.fixtures.testProjectInstall);
            const moduleJson = getModuleJson('someModule');
            delete moduleJson.name;
            saveModuleJson('someModule', moduleJson);
            const logStub = stubLog(MeteorDesktop.desktop, ['error'], true);
            MeteorDesktop.desktop.getModuleConfig(
                path.join(paths.fixtures.testProjectInstall, '.desktop', 'modules', 'someModule')
            );
            expect(logStub.stubs.error).to.have.been.calledWithMatch(
                sinon.match(/field defined in/)
            );
            logStub.restore();
        });
    });

    /*
     describe('#mergeDependencies', () => {
     it('should get all dependencies from .desktop', () => {
     shell.cp('-rf', paths.fixtures.desktop, paths.fixtures.testProjectInstall);
     const deps = MeteorDesktop.desktop.mergeDependencies(
     MeteorDesktop.electronApp.scaffold.getDefaultPackageJson().dependencies
     );
     expect(deps).to.have.a.property('dependency', '0.0.5');
     expect(deps).to.have.a.property('dependency2', '1.0.1');
     });

     it('should throw on dependency range', () => {
     shell.cp('-rf', paths.fixtures.desktop, paths.fixtures.testProjectInstall);
     const moduleJsonPath = path.join(paths.fixtures.testProjectInstall, '.desktop', 'modules', 'someModule', 'module.json');
     const moduleJson = JSON.parse(fs.readFileSync(moduleJsonPath, 'UTF-8'));
     moduleJson.dependencies.someDep = '^1.2.0';
     fs.writeFileSync(
     moduleJsonPath, JSON.stringify(moduleJson, null, 2)
     );
     expect(() => {
     const deps = MeteorDesktop.desktop.mergeDependencies(
     MeteorDesktop.electronApp.scaffold.getDefaultPackageJson().dependencies
     );
     }).to.throw(/version range/);
     });

     it('should throw on dependency conflict', () => {
     shell.cp('-rf', paths.fixtures.desktop, paths.fixtures.testProjectInstall);
     const moduleJsonPath = path.join(paths.fixtures.testProjectInstall, '.desktop', 'modules', 'someModule', 'module.json');
     const moduleJson = JSON.parse(fs.readFileSync(moduleJsonPath, 'UTF-8'));
     moduleJson.dependencies.dependency = '0.2.0';
     fs.writeFileSync(
     moduleJsonPath, JSON.stringify(moduleJson, null, 2)
     );
     expect(() => {
     const deps = MeteorDesktop.desktop.mergeDependencies(
     MeteorDesktop.electronApp.scaffold.getDefaultPackageJson().dependencies
     );
     }).to.throw(/Another version/);
     });

     it('should throw on dependency conflict with core', () => {
     shell.cp('-rf', paths.fixtures.desktop, paths.fixtures.testProjectInstall);
     const moduleJsonPath = path.join(paths.fixtures.testProjectInstall, '.desktop', 'modules', 'someModule', 'module.json');
     const moduleJson = JSON.parse(fs.readFileSync(moduleJsonPath, 'UTF-8'));
     moduleJson.dependencies.shelljs = '0.2.0';
     fs.writeFileSync(
     moduleJsonPath, JSON.stringify(moduleJson, null, 2)
     );
     expect(() => {
     const deps = MeteorDesktop.desktop.mergeDependencies(
     MeteorDesktop.electronApp.scaffold.getDefaultPackageJson().dependencies
     );
     }).to.throw(/Another version/);
     });

     });*/
});
