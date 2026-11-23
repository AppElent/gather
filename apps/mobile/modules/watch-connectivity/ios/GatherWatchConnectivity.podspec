# SPIKE (APP-652, do not merge): the phone half of the watch handoff.
Pod::Spec.new do |s|
  s.name           = 'GatherWatchConnectivity'
  s.version        = '0.0.0'
  s.summary        = 'Hands the watch device key to the Gather watch app over WatchConnectivity.'
  s.author         = 'AppElent'
  s.homepage       = 'https://github.com/AppElent/gather'
  s.license        = 'UNLICENSED'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks     = 'WatchConnectivity'
  s.source_files   = '**/*.swift'
end
