var ytsubgridApp = angular.module( "ytsubgridApp", ['localStorage'] );

ytsubgridApp.controller( 'AppCtrl',
	['$rootScope', 'appLoading',
		function ( $rootScope, appLoading ) {
			$rootScope.topScope = $rootScope;
			$rootScope.$on( '$routeChangeStart', function () {
				appLoading.loading();
			} );
		}]
);

ytsubgridApp.controller( 'AppHomeCtrl',
	['$scope', 'appLoading',
		function ( $scope, appLoading ) {
			appLoading.ready();
		}]
);

ytsubgridApp.controller( 'AppRepeatCtrl',
	['$scope', '$store', 'ytSubList', 'appLoading', '$timeout',
		function ( $scope, $store, ytSubList, appLoading, $timeout ) {
			$store.bind( $scope, 'userid', '' );
			$store.bind( $scope, 'videocache', {} );
			$store.bind( $scope, 'videos', {} );
			$store.bind( $scope, 'settings', {} );

			if ( $.isEmptyObject( $scope.settings ) ) {
				$scope.settings = {
					hidewatched: false,
					hidemuted:   true,
					theme:       'default'
				}
			}

			if ( $.isArray( $scope.videocache ) ) {
				$scope.videocache = {};
			}

			var datesort = function ( a, b ) {
				var datea = new Date( a.published );
				var dateb = new Date( b.published );

				if ( datea < dateb )
					return 1;
				if ( datea > dateb )
					return -1;
				return 0;
			};

			var checkData = function () {
				$scope.videos = _.uniq( $scope.videos );

				// Retrofit some parameters to existing data
				$.each( $scope.videos, function ( i, v ) {
					if ( typeof $scope.videos[i].watched == 'undefined' ) {
						$scope.videos[i].watched = $scope.videos[i].muted;
						$scope.videos[i].muted = false;
					}
				} );
			};

			var setUserid = function ( u ) {
				if ( typeof $scope.videocache[u] == 'undefined' ) {
					$scope.videocache[u] = [];
				}

				$scope.userid = u;

				$scope.videos = $scope.videocache[u];
			};

			var pushVideos = function ( data, code ) {
				if ( code == 200 ) {
					if ( typeof data != 'undefined' ) {
						for ( var i = 0; i < data.length; i++ ) {
							pushVideo( data[i] );
						}

						$scope.videos.sort( datesort );

						checkData();
					}
				} else if ( code == 403 ) {
					$scope.forbidden = 1;
				} else {
					$scope.notfound = 1;
				}

				appLoading.ready();
			};

			var pushVideo = function ( o ) {
				id = o['id']['$t']
					.replace( 'https://gdata.youtube.com/feeds/api/videos/', '' )
					.replace( 'http://gdata.youtube.com/feeds/api/videos/', '' );

				var details = {
					id:          id,
					link:        'https://www.youtube.com/watch?v=' + id,
					title:       o['title']['$t'],
					img:         o['media$group']['media$thumbnail'][0]['url'],
					authorlink:  o['author'][0]['uri']['$t']
									.replace( 'gdata.youtube.com/feeds/api/users/', 'www.youtube.com/user/' ),
					author:      o['author'][0]['name']['$t'],
					published:   o['published']['$t'],
					duration:    o['media$group']['yt$duration']['seconds'],
					muted:       false,
					muteddate:   null,
					watched:     false,
					watcheddate: null
				};

				var existing = false;

				var eid = 0;

				$.each( $scope.videos, function ( i, v ) {
					if ( $scope.videos[i].id == id ) {
						existing = true;

						eid = i;
					}
				} );

				if ( existing ) {
					// Update existing data
					$.each(
						[
							'id', 'link', 'title', 'img',
							'authorlink', 'author', 'published', 'duration'
						],
						function ( i, v ) {
							$scope.videos[eid][v] = details[v];
						}
					);
				} else {
					$scope.videos.push( details );
				}

				return true;
			};

			var resetErrors = function () {
				if ( $scope.forbidden == 1 || $scope.notfound == 1 ) {
					appLoading.loading();

					$scope.forbidden = 0;
					$scope.notfound = 0;

					appLoading.ready( 1 );
				}
			};

			var loadTop = function () {
				resetErrors();

				appLoading.loading();

				ytSubList( $scope.userid, 1, pushVideos );
			};

			$scope.loadBottom = function () {
				resetErrors();

				appLoading.loading();

				ytSubList( $scope.userid, $scope.videos.length + 1, pushVideos );
			};

			$scope.search = function ( q ) {
				if ( q == false ) {
					$scope.userid = '';
				} else {
					setUserid( q );

					loadTop();
				}
			};

			$scope.mute = function ( id ) {
				$.each( $scope.videos, function ( i, v ) {
					if ( v.id == id ) {
						$scope.videos[i].muted = !$scope.videos[i].muted;
						$scope.videos[i].muteddate = new Date().toISOString();
					}
				} );
			};

			$scope.watched = function ( id ) {
				$.each( $scope.videos, function ( i, v ) {
					if ( v.id == id ) {
						$scope.videos[i].watched = !$scope.videos[i].watched;
						$scope.videos[i].watcheddate = new Date().toISOString();
					}
				} );
			};

			if ( $scope.userid ) {
				setUserid( $scope.userid );

				loadTop();
			}

		}]
);

ytsubgridApp.factory( 'appLoading',
	['$rootScope',
		function ( $rootScope ) {
			var timer;
			return {
				loading: function () {
					clearTimeout( timer );

					$rootScope.status = 1;

					if ( !$rootScope.$$phase ) $rootScope.$apply();
				},
				ready:   function ( delay ) {
					function ready() {
						$rootScope.status = 0;

						if ( !$rootScope.$$phase ) $rootScope.$apply();
					}

					clearTimeout( timer );

					delay = delay == null ? 500 : false;

					jQuery( "abbr.timeago" ).timeago();

					if ( delay ) {
						timer = setTimeout( ready, delay );
					} else {
						ready();
					}
				}
			};
		}]
);

ytsubgridApp.factory( 'ytSubList',
	['$q',
		function ( $q ) {
			var searchToken = '{SEARCH}';

			var startToken = '{START}';

			var baseUrl = "https://gdata.youtube.com/feeds/api/users/" + searchToken + "/newsubscriptionvideos?alt=json&start-index=" + startToken + "&max-results=50";

			return function ( q, s, fn ) {
				var defer = $q.defer();

				var url = baseUrl.replace( searchToken, q ).replace( startToken, s );

				$.getJSON( url )
					.fail( function ( j, t, e ) {
						fn( e, j.status );
					} )
					.done( function ( json ) {
						fn( json.feed.entry, 200 );
					} )
				;
			};
		}]
);

ytsubgridApp.directive( 'scroll',
	['$window', '$document',
		function ( $window, $document ) {
			return function ( scope, elem, attrs ) {
				angular.element( $window ).bind( 'scroll', function () {
					if ( $document.height() <= $window.innerHeight + $window.pageYOffset ) {
						scope.$apply( attrs.scroll );
					}
				} );
			};
		}]
);

ytsubgridApp.filter( 'duration',
	function () {
		return function ( d ) {
			d = Number( d );

			var h = Math.floor( d / 3600 );
			var m = Math.floor( d % 3600 / 60 );
			var s = Math.floor( d % 3600 % 60 );

			return (
				( h > 0 ? h + ":" : "" )
					+ ( m > 0 ? (h > 0 && m < 10 ? "0" : "" ) + m + ":" : "00:")
					+ (s < 10 ? "0" : "") + s
				);
		};
	}
);

ytsubgridApp.filter( 'visible',
	function () {
		return function ( items, hidewatched, hidemuted ) {
			var filtered = [];

			angular.forEach( items, function ( item ) {
				if (
					!( ( item.muted && (hidemuted == "1") )
						|| ( item.watched && (hidewatched == "1") ) )
					) {
					filtered.push( item );
				}
			} );

			return filtered;
		};
	}
);
